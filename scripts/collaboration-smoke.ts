// Collaboration smoke test: verifies the full websocket multiplayer path
// against ANY running instance (local dev, local production build, or the
// deployed site) using nothing but HTTP + the real Hocuspocus protocol.
//
// What it proves end to end:
//   1. The instance is up and healthy.
//   2. Opening the app creates a page and an edit share link.
//   3. The share-token exchange issues a working edit session cookie.
//   4. Two edit sessions sync document changes in both directions.
//   5. Presence/awareness propagates between collaborators.
//   6. A view link mints a read-only session: it receives updates but its
//      own writes are dropped by the server.
//   7. Connections without a session are rejected.
//   8. Content survives full client disconnect (server-side persistence).
//
// Usage:
//   SMOKE_BASE_URL=https://richlaconte-tool.fly.dev pnpm test:smoke
//   pnpm test:smoke:local   # boots a local production build first
import {
  connectProbeClient,
  createProbePageState,
  expectProbeConnectionRejected,
  getProbeState,
  mutateProbeState,
  replaceProbeState,
  waitForProbeCondition,
  type ProbeClient,
} from '../src/server/collaborationProbe.ts'
import { PAGE_SESSION_COOKIE } from '../src/server/shareSessions.ts'
import type { PageAppState } from '../src/pagePersistence.ts'

const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  ''
)
const healthRetryMs = Number(process.env.SMOKE_HEALTH_RETRY_MS ?? 90_000)

const marker = `smoke ${new Date().toISOString()}`
const failures: string[] = []
const clients: ProbeClient[] = []

const track = (client: ProbeClient) => {
  clients.push(client)
  return client
}

const check = async (name: string, run: () => Promise<void>) => {
  try {
    await run()
    console.log(`  PASS  ${name}`)
  } catch (error) {
    failures.push(name)
    console.log(
      `  FAIL  ${name}\n        ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

// --- HTTP helpers ---------------------------------------------------------

// Follows one redirect hop manually so the session Set-Cookie is observable
// (fetch would otherwise hide intermediate headers).
const fetchManual = (url: string, cookie?: string) =>
  fetch(url, {
    headers: cookie ? { cookie } : undefined,
    redirect: 'manual',
  })

const getRedirectLocation = (response: Response, step: string) => {
  const location = response.headers.get('location')

  assert(
    response.status >= 300 && response.status < 400 && location,
    `${step}: expected a redirect with a Location header, got ${response.status}`
  )

  return new URL(location as string, baseUrl)
}

const getSessionCookie = (response: Response, step: string) => {
  const setCookies = response.headers.getSetCookie()
  const sessionCookie = setCookies.find((value) =>
    value.startsWith(`${PAGE_SESSION_COOKIE}=`)
  )

  assert(sessionCookie, `${step}: no ${PAGE_SESSION_COOKIE} Set-Cookie found`)

  return (sessionCookie as string).split(';')[0]
}

const exchangeShareUrlForCookie = async (shareUrl: URL, step: string) => {
  const response = await fetchManual(shareUrl.toString())

  return getSessionCookie(response, step)
}

const areaText = (state: PageAppState, index: number) => {
  const area = state.areas[index]

  return area && 'text' in area ? area.text : undefined
}

// --- Scenario -------------------------------------------------------------

console.log(`Collaboration smoke test against ${baseUrl}`)

// 1. Health, with a retry window to absorb deploy warm-up.
await check('instance is healthy', async () => {
  const startedAt = Date.now()
  let lastError: string

  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)

      if (response.ok) return

      lastError = `status ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    if (Date.now() - startedAt > healthRetryMs) {
      throw new Error(
        `/api/health did not return 200 within ${healthRetryMs}ms (${lastError!})`
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
})

// 2. Create a page exactly like a first-time visitor: GET / redirects to a
// fresh page URL carrying the edit share token.
let pageId = ''
let editShareUrl: URL | null = null

await check('visiting / creates a page with an edit share link', async () => {
  const response = await fetchManual(`${baseUrl}/`)
  const location = getRedirectLocation(response, 'create page')

  pageId = location.pathname.split('/')[2] ?? ''
  editShareUrl = location

  assert(pageId, `could not parse a page id from ${location.toString()}`)
  assert(
    location.searchParams.get('share') === 'edit' &&
      (location.searchParams.get('token') ?? '').length >= 10,
    'redirect URL does not carry a usable edit share token'
  )
})

// 3. Exchange the edit token for an editor session cookie.
let editCookieA = ''
let editCookieB = ''

await check('edit share token exchanges for a session cookie', async () => {
  assert(editShareUrl, 'no edit share URL from the previous step')
  editCookieA = await exchangeShareUrlForCookie(
    editShareUrl as URL,
    'edit token exchange (A)'
  )
  // A second exchange models a second collaborator opening the same link.
  editCookieB = await exchangeShareUrlForCookie(
    editShareUrl as URL,
    'edit token exchange (B)'
  )
  assert(
    editCookieA !== editCookieB,
    'each collaborator must receive a distinct session'
  )
})

// 4. Mint a view link through the share API, then exchange it.
let viewCookie = ''

await check('edit session can mint a view share link', async () => {
  assert(pageId && editCookieA, 'missing page id or edit session')

  const response = await fetch(
    `${baseUrl}/api/pages/${pageId}/share-links`,
    {
      body: JSON.stringify({ accessMode: 'view' }),
      headers: {
        'content-type': 'application/json',
        cookie: editCookieA,
      },
      method: 'POST',
    }
  )

  assert(response.ok, `share-link mint returned ${response.status}`)

  const payload = (await response.json()) as { url?: string }
  const viewUrl = new URL(payload.url ?? '', baseUrl)

  assert(
    viewUrl.searchParams.get('share') === 'view' &&
      (viewUrl.searchParams.get('token') ?? '').length >= 10,
    'minted URL is not a usable view share link'
  )

  viewCookie = await exchangeShareUrlForCookie(viewUrl, 'view token exchange')
})

// 5. Bidirectional realtime sync between two edit sessions.
let areaCount = 0

await check('two edit collaborators sync in both directions', async () => {
  assert(pageId && editCookieA && editCookieB, 'missing edit sessions')

  const editorA = track(
    await connectProbeClient({
      baseUrl,
      cookie: editCookieA,
      name: 'editor A',
      pageId,
    })
  )

  replaceProbeState(
    editorA.doc,
    createProbePageState({
      areaTexts: [`${marker} from A`],
      pageId,
      title: marker,
    })
  )

  const editorB = track(
    await connectProbeClient({
      baseUrl,
      cookie: editCookieB,
      name: 'editor B',
      pageId,
    })
  )

  // B receives A's content on initial sync.
  assert(
    areaText(getProbeState(editorB.doc), 0) === `${marker} from A`,
    'editor B did not receive editor A\'s content on join'
  )

  // B edits; A converges.
  mutateProbeState(editorB.doc, (state) => ({
    ...state,
    areas: state.areas.map((area) =>
      area.id === 'probe-area-0' && 'text' in area
        ? { ...area, text: `${marker} edited by B` }
        : area
    ),
  }))

  await waitForProbeCondition('editor A receives editor B\'s edit', () => {
    return (
      areaText(getProbeState(editorA.doc), 0) === `${marker} edited by B`
    )
  })

  areaCount = getProbeState(editorB.doc).areas.length
})

// 6. Presence/awareness between collaborators.
await check('presence propagates between collaborators', async () => {
  const [editorA, editorB] = clients

  assert(editorA && editorB, 'editors from the sync check are unavailable')

  editorA.provider.awareness?.setLocalStateField('presence', {
    clientId: 'smoke-client-a',
    color: '#2563eb',
    cursor: null,
    lastSeenAt: Date.now(),
    selectedAreaIds: [],
    userName: 'Smoke Tester',
  })

  await waitForProbeCondition('editor B observes editor A\'s presence', () => {
    const states = editorB.provider.awareness?.getStates()

    if (!states) return false

    return Array.from(states.values()).some(
      (state) =>
        (state as { presence?: { clientId?: string } }).presence
          ?.clientId === 'smoke-client-a'
    )
  })
})

// 7. View sessions are read-only on the server.
await check('view link receives updates but cannot write', async () => {
  assert(pageId && viewCookie, 'missing view session')

  const viewer = track(
    await connectProbeClient({
      baseUrl,
      cookie: viewCookie,
      name: 'viewer',
      pageId,
    })
  )

  assert(
    areaText(getProbeState(viewer.doc), 0) === `${marker} edited by B`,
    'viewer did not receive the current document state'
  )

  viewer.destroy()

  // The viewer tries to write anyway (a malicious or buggy client); the
  // server must drop it because the connection is read-only.
  const maliciousViewer = track(
    await connectProbeClient({
      baseUrl,
      cookie: viewCookie,
      name: 'malicious viewer',
      pageId,
    })
  )

  replaceProbeState(
    maliciousViewer.doc,
    createProbePageState({
      areaTexts: [`${marker} ILLEGAL VIEWER WRITE`],
      pageId,
    })
  )

  await new Promise((resolve) => setTimeout(resolve, 750))
  maliciousViewer.destroy()

  const auditor = track(
    await connectProbeClient({
      baseUrl,
      cookie: editCookieB,
      name: 'auditor',
      pageId,
    })
  )

  const auditedState = getProbeState(auditor.doc)

  assert(
    auditedState.areas.length === areaCount,
    `server accepted a read-only write (expected ${areaCount} areas, found ${auditedState.areas.length})`
  )
  assert(
    areaText(auditedState, 0) === `${marker} edited by B`,
    'server state changed after a read-only write attempt'
  )
})

// 8. Unauthenticated websocket connections are rejected.
await check('connections without a session are rejected', async () => {
  assert(pageId, 'missing page id')

  const reason = await expectProbeConnectionRejected({
    baseUrl,
    name: 'anonymous',
    pageId,
  })

  assert(
    /authentication failed/i.test(reason),
    `unexpected rejection path: ${reason}`
  )
})

// 9. Persistence: with every client gone, a fresh collaborator still gets
// the full document.
await check('document persists after all clients disconnect', async () => {
  assert(pageId && editCookieB, 'missing edit session')

  for (const client of clients.splice(0)) {
    client.destroy()
  }

  const lateJoiner = track(
    await connectProbeClient({
      baseUrl,
      cookie: editCookieB,
      name: 'late joiner',
      pageId,
    })
  )

  await waitForProbeCondition('late joiner receives persisted state', () => {
    return (
      areaText(getProbeState(lateJoiner.doc), 0) === `${marker} edited by B`
    )
  })

  lateJoiner.destroy()
})

// --- Result ---------------------------------------------------------------

for (const client of clients) {
  try {
    client.destroy()
  } catch {
    // Already destroyed.
  }
}

if (failures.length > 0) {
  console.log(`\nSmoke test FAILED (${failures.length} failing checks):`)
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}

console.log('\nSmoke test passed: collaboration is healthy.')
process.exit(0)
