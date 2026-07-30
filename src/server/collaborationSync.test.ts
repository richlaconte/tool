// Integration tests for the websocket collaboration path: a real HTTP
// server, the real Hocuspocus server with its SQLite extension, and real
// Hocuspocus provider clients over real websockets. These tests cover the
// behavior that unit tests cannot (protocol, auth handshake, broadcast,
// read-only enforcement, persistence) without paying browser E2E costs.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Duplex } from 'node:stream'
import test from 'node:test'

import Database from 'better-sqlite3'
import * as Y from 'yjs'

import type { PageAppState } from '../pagePersistence.ts'
import {
  connectProbeClient,
  createProbePageState,
  expectProbeConnectionRejected,
  getProbeState,
  mutateProbeState,
  replaceProbeState,
  waitForProbeCondition,
  type ProbeClient,
} from './collaborationProbe.ts'
import {
  createCollaborationServer,
  type CollaborationServerOptions,
} from './collaborationServer.ts'
import { createInMemoryDatabase, type ToolDatabase } from './database.ts'
import { createPageWithShareLinks } from './pageRepository.ts'
import { createPageSessionCookie } from './shareSessions.ts'

const secret = 'collaboration-sync-test-secret-long-enough'
const now = '2026-07-30T12:00:00.000Z'

type Harness = {
  baseUrl: string
  close: () => Promise<void>
  database: ToolDatabase
  makeCookie: (
    pageId: string,
    accessMode: 'edit' | 'view',
    clientId: string
  ) => string
  seedPage: (pageId: string) => void
  yjsDatabasePath: string
}

const startHarness = async (
  options: Pick<CollaborationServerOptions, 'allowedOrigins'> = {}
): Promise<Harness> => {
  const database = createInMemoryDatabase()
  const yjsDatabasePath = path.join(
    tmpdir(),
    `collaboration-sync-test-${randomUUID()}.sqlite`
  )
  const collaborationServer = createCollaborationServer({
    allowedOrigins: options.allowedOrigins,
    databasePath: yjsDatabasePath,
    pageDatabase: database,
    sessionSecret: secret,
  })
  const httpServer: Server = createServer((request, response) => {
    void request
    response.writeHead(404)
    response.end()
  })

  // Track every socket (including upgraded websocket sockets, which
  // closeAllConnections does not cover) so tests can fully tear down.
  const sockets = new Set<Duplex>()
  const trackSocket = (socket: Duplex) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  }

  httpServer.on('connection', trackSocket)

  httpServer.on('upgrade', (request, socket, head) => {
    trackSocket(socket)

    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (requestUrl.pathname === '/collaboration') {
      collaborationServer.handleUpgrade(request, socket, head)
      return
    }

    socket.destroy()
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve)
  })

  const address = httpServer.address()

  if (!address || typeof address === 'string') {
    throw new Error('Test server has no port.')
  }

  const close = async () => {
    // Destroy the Hocuspocus instance (closing connections and stopping the
    // SQLite extension's debounce/store timers) before removing its database
    // files, so teardown neither hangs the process nor races a pending store.
    await collaborationServer.destroy()

    for (const socket of sockets) {
      socket.destroy()
    }

    httpServer.close()

    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(`${yjsDatabasePath}${suffix}`, { force: true })
    }
  }

  return {
    baseUrl: `http://localhost:${address.port}`,
    close,
    database,
    makeCookie: (pageId, accessMode, clientId) => {
      // Expiry must be relative to the real clock: the server validates
      // against Date.now(), while shareLinkUpdatedAt must match the
      // seeded share-link timestamp exactly.
      const realNow = Date.now()

      return createPageSessionCookie(
        {
          accessMode,
          clientId,
          expiresAt: realNow + 3_600_000,
          pageId,
          shareLinkUpdatedAt: now,
        },
        secret,
        realNow
      ).split(';')[0]
    },
    seedPage: (pageId) => {
      createPageWithShareLinks(database, { now, pageId })
    },
    yjsDatabasePath,
  }
}

const areaText = (state: PageAppState, index: number) => {
  const area = state.areas[index]

  return area && 'text' in area ? area.text : undefined
}

const destroyAll = (...clients: Array<ProbeClient | undefined>) => {
  for (const client of clients) {
    try {
      client?.destroy()
    } catch {
      // Already destroyed.
    }
  }
}

test('two edit clients sync area content bidirectionally over websockets', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_sync')

  const clientA = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_sync', 'edit', 'client_a'),
    name: 'A',
    pageId: 'page_sync',
  })

  replaceProbeState(
    clientA.doc,
    createProbePageState({ areaTexts: ['Typed by A'], pageId: 'page_sync' })
  )

  const clientB = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_sync', 'edit', 'client_b'),
    name: 'B',
    pageId: 'page_sync',
  })

  // B sees A's content immediately after the initial sync.
  assert.equal(areaText(getProbeState(clientB.doc), 0), 'Typed by A')

  // B edits the same area and A converges to B's value.
  mutateProbeState(clientB.doc, (state) => ({
    ...state,
    areas: state.areas.map((area) =>
      area.id === 'probe-area-0' && 'text' in area
        ? { ...area, text: 'Edited by B' }
        : area
    ),
  }))

  await waitForProbeCondition('A receives B\'s edit', () => {
    return areaText(getProbeState(clientA.doc), 0) === 'Edited by B'
  })

  destroyAll(clientA, clientB)
})

test('view-link clients receive updates but their own writes are dropped', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_view')

  const editor = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_view', 'edit', 'client_editor'),
    name: 'editor',
    pageId: 'page_view',
  })

  replaceProbeState(
    editor.doc,
    createProbePageState({
      areaTexts: ['Shared content'],
      pageId: 'page_view',
    })
  )

  const viewer = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_view', 'view', 'client_viewer'),
    name: 'viewer',
    pageId: 'page_view',
  })

  // The viewer receives live state...
  assert.equal(areaText(getProbeState(viewer.doc), 0), 'Shared content')

  // ...but when it tries to write, the server drops the update: the
  // connection was marked read-only during onAuthenticate.
  replaceProbeState(
    viewer.doc,
    createProbePageState({
      areaTexts: ['Viewer write'],
      pageId: 'page_view',
    })
  )

  await new Promise((resolve) => setTimeout(resolve, 750))

  assert.notEqual(
    areaText(getProbeState(editor.doc), 0),
    'Viewer write',
    'editor must never receive the read-only viewer\'s write'
  )

  // A fresh editor sees only the server-truth state.
  const freshEditor = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_view', 'edit', 'client_editor_2'),
    name: 'fresh editor',
    pageId: 'page_view',
  })

  const freshState = getProbeState(freshEditor.doc)

  assert.equal(freshState.areas.length, 1)
  assert.equal(areaText(freshState, 0), 'Shared content')

  destroyAll(editor, viewer, freshEditor)
})

test('connections without a valid session are rejected at authentication', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_auth')

  // No cookie at all.
  const anonymousReason = await expectProbeConnectionRejected({
    baseUrl: harness.baseUrl,
    name: 'anonymous',
    pageId: 'page_auth',
  })

  assert.match(anonymousReason, /authentication failed/i)

  // A valid session for a different page.
  const wrongPageReason = await expectProbeConnectionRejected({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_other', 'edit', 'client_elsewhere'),
    name: 'wrong-page',
    pageId: 'page_auth',
  })

  assert.match(wrongPageReason, /authentication failed/i)
})

test('documents are isolated per page', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_iso_a')
  harness.seedPage('page_iso_b')

  const clientA = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_iso_a', 'edit', 'client_iso_a'),
    name: 'A',
    pageId: 'page_iso_a',
  })
  const clientB = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_iso_b', 'edit', 'client_iso_b'),
    name: 'B',
    pageId: 'page_iso_b',
  })

  replaceProbeState(
    clientA.doc,
    createProbePageState({
      areaTexts: ['Only on page A'],
      pageId: 'page_iso_a',
    })
  )

  await new Promise((resolve) => setTimeout(resolve, 750))

  assert.equal(getProbeState(clientB.doc).areas.length, 0)

  destroyAll(clientA, clientB)
})

test('server persists document state to SQLite for later sessions', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_persist')

  const writer = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_persist', 'edit', 'client_writer'),
    name: 'writer',
    pageId: 'page_persist',
  })

  replaceProbeState(
    writer.doc,
    createProbePageState({
      areaTexts: ['Durable content'],
      pageId: 'page_persist',
    })
  )

  // The SQLite extension stores debounced; wait until the row exists on
  // disk and decodes back to the written state.
  await waitForProbeCondition(
    'document row persisted to SQLite',
    () => {
      const database = new Database(harness.yjsDatabasePath, {
        readonly: true,
      })

      try {
        const row = database
          .prepare('select data from documents where name = ?')
          .get('page:page_persist') as { data: Buffer } | undefined

        if (!row) return false

        const doc = new Y.Doc()
        Y.applyUpdate(doc, new Uint8Array(row.data))
        const persisted = areaText(getProbeState(doc), 0)
        doc.destroy()

        return persisted === 'Durable content'
      } finally {
        database.close()
      }
    },
    { timeoutMs: 15_000 }
  )

  writer.destroy()

  // A client that joins after the writer left still receives the state.
  const lateReader = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_persist', 'edit', 'client_late'),
    name: 'late reader',
    pageId: 'page_persist',
  })

  await waitForProbeCondition('late reader sees persisted state', () => {
    return areaText(getProbeState(lateReader.doc), 0) === 'Durable content'
  })

  destroyAll(lateReader)
})

test('awareness presence propagates between connected clients', async (t) => {
  const harness = await startHarness()
  t.after(harness.close)
  harness.seedPage('page_aware')

  const clientA = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_aware', 'edit', 'client_aware_a'),
    name: 'A',
    pageId: 'page_aware',
  })
  const clientB = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_aware', 'edit', 'client_aware_b'),
    name: 'B',
    pageId: 'page_aware',
  })

  clientA.provider.awareness?.setLocalStateField('presence', {
    clientId: 'client_aware_a',
    color: '#2563eb',
    cursor: null,
    lastSeenAt: Date.now(),
    selectedAreaIds: [],
    userName: 'Canvas Pilot',
  })

  await waitForProbeCondition('B observes A\'s presence', () => {
    const states = clientB.provider.awareness?.getStates()

    if (!states) return false

    return Array.from(states.values()).some(
      (state) =>
        (state as { presence?: { clientId?: string } }).presence
          ?.clientId === 'client_aware_a'
    )
  })

  destroyAll(clientA, clientB)
})

test('origin allowlist is enforced on the websocket handshake', async (t) => {
  const harness = await startHarness({
    allowedOrigins: ['https://allowed.example'],
  })
  t.after(harness.close)
  harness.seedPage('page_origin')

  const rejectedReason = await expectProbeConnectionRejected({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_origin', 'edit', 'client_origin'),
    name: 'evil-origin',
    origin: 'https://evil.example',
    pageId: 'page_origin',
  })

  assert.match(rejectedReason, /authentication failed/i)

  const allowed = await connectProbeClient({
    baseUrl: harness.baseUrl,
    cookie: harness.makeCookie('page_origin', 'edit', 'client_origin_ok'),
    name: 'allowed-origin',
    origin: 'https://allowed.example',
    pageId: 'page_origin',
  })

  destroyAll(allowed)
})



