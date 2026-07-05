import type { ToolDatabase } from './database.ts'
import { getPageRecord } from './pageRepository.ts'
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
      reason: 'edit-session-required' | 'owner-required'
    }

export const listMcpTokenConnections = ({
  authenticatedUserId,
  cookieHeader,
  database,
  now = Date.now(),
  pageId,
  secret,
}: {
  authenticatedUserId?: string | null
  cookieHeader?: string
  database: ToolDatabase
  now?: number
  pageId: string
  secret: string
}): McpTokenMutationResult => {
  const access = getMcpManagementAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    now,
    pageId,
    secret,
  })
  if ('kind' in access) return access

  return {
    kind: 'ok',
    tokens: listMcpTokens(database, pageId),
  }
}

export const createMcpTokenConnection = ({
  authenticatedUserId,
  cookieHeader,
  database,
  expiresAt,
  label,
  now = new Date().toISOString(),
  pageId,
  scopes,
  secret,
}: {
  authenticatedUserId?: string | null
  cookieHeader?: string
  database: ToolDatabase
  expiresAt?: string | null
  label?: string
  now?: string
  pageId: string
  scopes: unknown
  secret: string
}): McpTokenMutationResult => {
  const access = getMcpManagementAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    now: Date.parse(now),
    pageId,
    secret,
  })
  if ('kind' in access) return access

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
  authenticatedUserId,
  cookieHeader,
  database,
  now = new Date().toISOString(),
  pageId,
  secret,
  tokenId,
}: {
  authenticatedUserId?: string | null
  cookieHeader?: string
  database: ToolDatabase
  now?: string
  pageId: string
  secret: string
  tokenId: unknown
}): McpTokenMutationResult => {
  const access = getMcpManagementAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    now: Date.parse(now),
    pageId,
    secret,
  })
  if ('kind' in access) return access

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

const getMcpManagementAccess = ({
  authenticatedUserId,
  cookieHeader,
  database,
  now,
  pageId,
  secret,
}: {
  authenticatedUserId?: string | null
  cookieHeader?: string
  database: ToolDatabase
  now: number
  pageId: string
  secret: string
}): { ok: true } | Extract<McpTokenMutationResult, { kind: 'forbidden' }> => {
  const session = getPageSessionFromCookie(
    cookieHeader,
    secret,
    Number.isFinite(now) ? now : Date.now()
  )
  const access = getPageAccessFromSession(database, pageId, session)

  if (!session || access?.accessMode !== 'edit') {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  const page = getPageRecord(database, pageId)
  if (page?.ownerUserId && page.ownerUserId !== authenticatedUserId) {
    return {
      kind: 'forbidden',
      reason: 'owner-required',
    }
  }

  return {
    ok: true,
  }
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
