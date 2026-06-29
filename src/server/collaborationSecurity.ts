import {
  createFixedWindowRateLimiter,
  type RateLimitConfig,
} from './rateLimit.ts'

export type CollaborationSecurityConfig = {
  maxConnectionsPerClient: number
  maxConnectionsPerPage: number
  maxPayloadBytes: number
  messageRateLimit: RateLimitConfig
}

export type CollaborationSecurityConnection = {
  clientId: string
  pageId: string
  socketId: string
}

export type CollaborationSecurityResult =
  | {
      ok: true
    }
  | {
      ok: false
      reason:
        | 'client-connection-limit'
        | 'page-connection-limit'
        | 'message-rate-limit'
        | 'message-too-large'
      retryAfterSeconds?: number
    }

const DEFAULT_COLLABORATION_SECURITY_CONFIG: CollaborationSecurityConfig = {
  maxConnectionsPerClient: 8,
  maxConnectionsPerPage: 50,
  maxPayloadBytes: 1024 * 1024,
  messageRateLimit: {
    limit: 240,
    windowMs: 60_000,
  },
}

export const getCollaborationSecurityConfigFromEnv = (
  env: Record<string, string | undefined> = process.env
): CollaborationSecurityConfig => ({
  maxConnectionsPerClient: readPositiveInteger(
    env.TOOL_COLLABORATION_MAX_CONNECTIONS_PER_CLIENT,
    DEFAULT_COLLABORATION_SECURITY_CONFIG.maxConnectionsPerClient
  ),
  maxConnectionsPerPage: readPositiveInteger(
    env.TOOL_COLLABORATION_MAX_CONNECTIONS_PER_PAGE,
    DEFAULT_COLLABORATION_SECURITY_CONFIG.maxConnectionsPerPage
  ),
  maxPayloadBytes: readPositiveInteger(
    env.TOOL_COLLABORATION_MAX_PAYLOAD_BYTES,
    DEFAULT_COLLABORATION_SECURITY_CONFIG.maxPayloadBytes
  ),
  messageRateLimit: {
    limit: readPositiveInteger(
      env.TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_MAX,
      DEFAULT_COLLABORATION_SECURITY_CONFIG.messageRateLimit.limit
    ),
    windowMs: readPositiveInteger(
      env.TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_COLLABORATION_SECURITY_CONFIG.messageRateLimit.windowMs
    ),
  },
})

export const createCollaborationSecurityState = ({
  config = DEFAULT_COLLABORATION_SECURITY_CONFIG,
  now = Date.now,
}: {
  config?: CollaborationSecurityConfig
  now?: () => number
} = {}) => {
  const connections = new Map<string, CollaborationSecurityConnection>()
  const pageCounts = new Map<string, number>()
  const clientCounts = new Map<string, number>()
  const messageLimiter = createFixedWindowRateLimiter({
    ...config.messageRateLimit,
    now,
  })
  const disconnect = (socketId: string) => {
    const connection = connections.get(socketId)
    if (!connection) return

    connections.delete(socketId)
    decrementCount(pageCounts, connection.pageId)
    decrementCount(clientCounts, connection.clientId)
  }

  return {
    connect(connection: CollaborationSecurityConnection): CollaborationSecurityResult {
      const existingConnection = connections.get(connection.socketId)
      if (existingConnection) disconnect(connection.socketId)

      if ((pageCounts.get(connection.pageId) ?? 0) >= config.maxConnectionsPerPage) {
        return {
          ok: false,
          reason: 'page-connection-limit',
        }
      }

      if ((clientCounts.get(connection.clientId) ?? 0) >= config.maxConnectionsPerClient) {
        return {
          ok: false,
          reason: 'client-connection-limit',
        }
      }

      connections.set(connection.socketId, connection)
      incrementCount(pageCounts, connection.pageId)
      incrementCount(clientCounts, connection.clientId)

      return {
        ok: true,
      }
    },

    disconnect,

    checkMessage({
      byteLength,
      clientId,
      pageId,
    }: {
      byteLength: number
      clientId: string
      pageId: string
    }): CollaborationSecurityResult {
      if (byteLength > config.maxPayloadBytes) {
        return {
          ok: false,
          reason: 'message-too-large',
        }
      }

      const rateLimitResult = messageLimiter.check(`${pageId}:${clientId}`)

      if (!rateLimitResult.ok) {
        return {
          ok: false,
          reason: 'message-rate-limit',
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        }
      }

      return {
        ok: true,
      }
    },
  }
}

const incrementCount = (counts: Map<string, number>, key: string) => {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

const decrementCount = (counts: Map<string, number>, key: string) => {
  const nextCount = (counts.get(key) ?? 0) - 1

  if (nextCount <= 0) {
    counts.delete(key)
    return
  }

  counts.set(key, nextCount)
}

const readPositiveInteger = (
  value: string | undefined,
  fallback: number
) => {
  const parsedValue = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback
}
