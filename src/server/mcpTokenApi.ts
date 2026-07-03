import type { ToolDatabase } from './database.ts'
import {
  listMcpTokens,
  mintMcpToken,
  revokeMcpToken,
  type McpAgentScope,
  type McpTokenRecord,
} from './mcpTokens.ts'
import { getPageAccessFromSession } from './pageAccess.ts'
import { getPageSessionFromCookie } from './shareSessions.ts'

export type McpTokenMutationResult =
  | {
      kind: 'ok'
      token?: string
      tokens: McpTokenRecord[]
    }
  | {
      kind: 'bad-request'
      reason: 'invalid-token-request'
    }
  | {
      kind: 'forbidden'
      reason: 'edit-session-required'
    }

export const listMcpTokenConnections = ({
  cookieHeader,
  database,
  now = Date.now(),
  pageId,
  secret,
}: {
  cookieHeader?: string
  database: ToolDatabase
  now?: number
  pageId: string
  secret: string
}): McpTokenMutationResult => {
  if (!hasEditAccess({ cookieHeader, database, now, pageId, secret })) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  return {
    kind: 'ok',
    tokens: listMcpTokens(database, pageId),
  }
}

export const createMcpTokenConnection = ({
  cookieHeader,
  database,
  expiresAt,
  label,
  now = new Date().toISOString(),
  pageId,
  scopes,
  secret,
}: {
  cookieHeader?: string
  database: ToolDatabase
  expiresAt?: string | null
  label?: string
  now?: string
  pageId: string
  scopes: unknown
  secret: string
}): McpTokenMutationResult => {
  if (
    !hasEditAccess({
      cookieHeader,
      database,
      now: Date.parse(now),
      pageId,
      secret,
    })
  ) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  const normalizedScopes = normalizeRequestedScopes(scopes)

  if (normalizedScopes.length === 0) {
    return {
      kind: 'bad-request',
      reason: 'invalid-token-request',
    }
  }

  const minted = mintMcpToken(database, {
    expiresAt,
    label,
    now,
    pageId,
    scopes: normalizedScopes,
  })

  return {
    kind: 'ok',
    token: minted.token,
    tokens: listMcpTokens(database, pageId),
  }
}

export const revokeMcpTokenConnection = ({
  cookieHeader,
  database,
  now = new Date().toISOString(),
  pageId,
  secret,
  tokenId,
}: {
  cookieHeader?: string
  database: ToolDatabase
  now?: string
  pageId: string
  secret: string
  tokenId: unknown
}): McpTokenMutationResult => {
  if (
    !hasEditAccess({
      cookieHeader,
      database,
      now: Date.parse(now),
      pageId,
      secret,
    })
  ) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  if (typeof tokenId !== 'string' || !tokenId.trim()) {
    return {
      kind: 'bad-request',
      reason: 'invalid-token-request',
    }
  }

  revokeMcpToken(database, tokenId, {
    now,
    pageId,
  })

  return {
    kind: 'ok',
    tokens: listMcpTokens(database, pageId),
  }
}

const hasEditAccess = ({
  cookieHeader,
  database,
  now,
  pageId,
  secret,
}: {
  cookieHeader?: string
  database: ToolDatabase
  now: number
  pageId: string
  secret: string
}) => {
  const session = getPageSessionFromCookie(
    cookieHeader,
    secret,
    Number.isFinite(now) ? now : Date.now()
  )
  const access = getPageAccessFromSession(database, pageId, session)

  return Boolean(session && access?.accessMode === 'edit')
}

const normalizeRequestedScopes = (scopes: unknown): McpAgentScope[] => {
  const validScopes = new Set<McpAgentScope>([
    'page:read',
    'page:search',
    'page:suggest',
    'page:write',
  ])

  if (!Array.isArray(scopes)) return []

  return Array.from(
    new Set(
      scopes.filter((scope): scope is McpAgentScope =>
        validScopes.has(scope)
      )
    )
  )
}
