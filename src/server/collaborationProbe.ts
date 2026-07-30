// Shared collaboration probe client: a real Hocuspocus/Yjs websocket client
// usable from Node (unit-of-work integration tests and the deploy smoke
// script) so sync behavior is verified against the same protocol the
// browser uses, without needing a browser.
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebSocket } from 'ws'
import * as Y from 'yjs'

import {
  applyCollaborativePageStatePatch,
  getPageStateFromCollaborativeDoc,
  replaceCollaborativePageDocState,
} from '../collaborativePage.ts'
import {
  createDefaultPageState,
  type PageAppState,
} from '../pagePersistence.ts'

export type ProbeClientOptions = {
  baseUrl: string
  cookie?: string
  name?: string
  origin?: string
  pageId: string
  timeoutMs?: number
}

export type ProbeClient = {
  destroy: () => void
  doc: Y.Doc
  provider: HocuspocusProvider
}

export class ProbeError extends Error {}

const DEFAULT_TIMEOUT_MS = 10_000

const getWebSocketUrl = (baseUrl: string) => {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/collaboration'
  url.search = ''

  return url.toString()
}

// The Hocuspocus provider constructs the WebSocket with only a URL, so the
// session cookie and Origin (both required by the server's onAuthenticate)
// are injected through a WebSocket polyfill subclass. Instances are
// registered so they can be force-terminated on destroy: a polite close
// handshake against an already-closing server can leave the client socket
// (and with it the Node process) hanging.
const createProbeWebSocketPolyfill = (
  headers: Record<string, string>,
  registry: Set<WebSocket>
) =>
  class ProbeWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols, { headers })
      registry.add(this)
    }
  }

export const connectProbeClient = ({
  baseUrl,
  cookie,
  name,
  origin,
  pageId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ProbeClientOptions): Promise<ProbeClient> => {
  const headers: Record<string, string> = {
    origin: origin ?? new URL(baseUrl).origin,
  }

  if (cookie) headers.cookie = cookie

  const doc = new Y.Doc()
  const webSockets = new Set<WebSocket>()
  const terminateWebSockets = () => {
    for (const webSocket of webSockets) {
      webSocket.terminate()
    }
    webSockets.clear()
  }
  const provider = new HocuspocusProvider({
    document: doc,
    name: `page:${pageId}`,
    url: getWebSocketUrl(baseUrl),
    WebSocketPolyfill: createProbeWebSocketPolyfill(
      headers,
      webSockets
    ) as unknown as typeof WebSocket,
    // One attempt: a rejected handshake should surface immediately instead
    // of disappearing into reconnect backoff.
    maxAttempts: 1,
  } as unknown as ConstructorParameters<typeof HocuspocusProvider>[0])

  return new Promise<ProbeClient>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      provider.destroy()
      terminateWebSockets()
      reject(
        new ProbeError(
          `Timed out waiting for ${name ?? 'client'} to sync (pageId=${pageId}).`
        )
      )
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timer)
      provider.off('synced', handleSynced)
      provider.off('authenticationFailed', handleAuthenticationFailed)
    }

    const handleSynced = ({ state }: { state: boolean }) => {
      if (!state) return

      cleanup()
      resolve({
        destroy: () => {
          provider.destroy()
          terminateWebSockets()

          if (!doc.isDestroyed) doc.destroy()
        },
        doc,
        provider,
      })
    }

    const handleAuthenticationFailed = ({ reason }: { reason: string }) => {
      cleanup()
      provider.destroy()
      terminateWebSockets()
      reject(
        new ProbeError(
          `Authentication failed for ${name ?? 'client'} (pageId=${pageId}): ${reason}`
        )
      )
    }

    provider.on('synced', handleSynced)
    provider.on('authenticationFailed', handleAuthenticationFailed)
  })
}

// Asserts that a connection cannot be established: resolves with the
// rejection reason once the server refuses authentication, rejects if the
// client unexpectedly syncs.
export const expectProbeConnectionRejected = (
  options: ProbeClientOptions
): Promise<string> =>
  connectProbeClient(options).then(
    (client) => {
      client.destroy()
      throw new ProbeError(
        `Expected connection to be rejected but it synced (pageId=${options.pageId}).`
      )
    },
    (error: unknown) =>
      error instanceof Error ? error.message : String(error)
  )

export const getProbeState = (doc: Y.Doc): PageAppState =>
  getPageStateFromCollaborativeDoc(doc)

export const replaceProbeState = (doc: Y.Doc, state: PageAppState) => {
  replaceCollaborativePageDocState(doc, state, 'collaboration-probe')
}

// Applies a mutation through the same patch path the app uses, so probes
// exercise incremental updates rather than only full-document replacement.
export const mutateProbeState = (
  doc: Y.Doc,
  mutate: (state: PageAppState) => PageAppState
) => {
  const previousState = getPageStateFromCollaborativeDoc(doc)
  const nextState = mutate(previousState)

  applyCollaborativePageStatePatch(
    doc,
    previousState,
    nextState,
    'collaboration-probe'
  )
}

export const createProbePageState = ({
  areaTexts = [],
  pageId,
  title = 'Collaboration probe page',
}: {
  areaTexts?: string[]
  pageId: string
  title?: string
}): PageAppState => {
  const now = new Date().toISOString()

  return {
    page: {
      ...createDefaultPageState({ id: pageId, now }),
      title,
    },
    areas: areaTexts.map((text, index) => ({
      id: `probe-area-${index}`,
      parentId: null,
      x: 40 + index * 40,
      y: 40 + index * 40,
      width: 260,
      height: 120,
      text,
      metadata: {
        kind: 'note' as const,
        status: 'open' as const,
        tags: ['collaboration-probe'],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    })),
    assets: [],
    links: [],
    comments: [],
    journal: [],
  }
}

export const waitForProbeCondition = async (
  description: string,
  condition: () => boolean | Promise<boolean>,
  { intervalMs = 100, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
): Promise<void> => {
  const startedAt = Date.now()

  for (;;) {
    if (await condition()) return

    if (Date.now() - startedAt > timeoutMs) {
      throw new ProbeError(
        `Timed out after ${timeoutMs}ms waiting for: ${description}`
      )
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
