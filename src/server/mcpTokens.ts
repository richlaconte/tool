import { createHash, randomBytes, randomUUID } from 'node:crypto'

import type { ToolDatabase } from './database.ts'

export type McpAgentScope =
  | 'page:read'
  | 'page:search'
  | 'page:suggest'
  | 'page:write'

export type McpAgentClient = {
  id: string
  displayName: string
  scopes: McpAgentScope[]
}

export type McpTokenRecord = {
  id: string
  pageId: string
  scopes: McpAgentScope[]
  label: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

export type MintMcpTokenOptions = {
  createToken?: () => string
  expiresAt?: string | null
  label?: string
  now?: string
  pageId: string
  scopes: McpAgentScope[]
}

export type ValidateMcpTokenResult =
  | {
      ok: true
      client: McpAgentClient
      token: McpTokenRecord
    }
  | {
      ok: false
      reason:
        | 'missing'
        | 'invalid'
        | 'expired'
        | 'revoked'
        | 'wrong-page'
      pageId?: string
      tokenId?: string
    }

type McpTokenRow = {
  id: string
  pageId: string
  scopes: string
  label: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

const DEFAULT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
const TOKEN_PREFIX = 'cscd_'

export const mintMcpToken = (
  database: ToolDatabase,
  {
    createToken = createMcpTokenSecret,
    expiresAt,
    label = 'Agent connection',
    now = new Date().toISOString(),
    pageId,
    scopes,
  }: MintMcpTokenOptions
) => {
  const token = createToken()
  const normalizedScopes = normalizeScopes(scopes)
  const record: McpTokenRecord = {
    id: `mcp_token_${randomUUID()}`,
    pageId,
    scopes: normalizedScopes,
    label: normalizeLabel(label),
    createdAt: now,
    expiresAt:
      expiresAt === undefined
        ? new Date(Date.parse(now) + DEFAULT_TOKEN_TTL_MS).toISOString()
        : expiresAt,
    revokedAt: null,
    lastUsedAt: null,
  }

  database
    .prepare(
      `insert into mcp_tokens
        (id, token_hash, page_id, scopes, label, created_at, expires_at,
         revoked_at, last_used_at)
       values (?, ?, ?, ?, ?, ?, ?, null, null)`
    )
    .run(
      record.id,
      hashMcpToken(token),
      record.pageId,
      JSON.stringify(record.scopes),
      record.label,
      record.createdAt,
      record.expiresAt
    )

  return {
    token,
    record,
  }
}

export const validateMcpToken = (
  database: ToolDatabase,
  token: string | null | undefined,
  {
    now = new Date().toISOString(),
    pageId,
  }: {
    now?: string
    pageId?: string
  } = {}
): ValidateMcpTokenResult => {
  if (!token) return { ok: false, reason: 'missing' }

  const row = database
    .prepare(
      `select id,
              page_id as pageId,
              scopes,
              label,
              created_at as createdAt,
              expires_at as expiresAt,
              revoked_at as revokedAt,
              last_used_at as lastUsedAt
       from mcp_tokens
       where token_hash = ?
       limit 1`
    )
    .get(hashMcpToken(token)) as McpTokenRow | undefined

  if (!row) return { ok: false, reason: 'invalid' }

  const record = rowToRecord(row)

  if (record.revokedAt) {
    return {
      ok: false,
      reason: 'revoked',
      tokenId: record.id,
      pageId: record.pageId,
    }
  }

  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.parse(now)) {
    return {
      ok: false,
      reason: 'expired',
      tokenId: record.id,
      pageId: record.pageId,
    }
  }

  if (pageId && record.pageId !== pageId) {
    return {
      ok: false,
      reason: 'wrong-page',
      tokenId: record.id,
      pageId: record.pageId,
    }
  }

  touchLastUsed(database, record.id, now)

  return {
    ok: true,
    token: {
      ...record,
      lastUsedAt: now,
    },
    client: {
      id: record.id,
      displayName: record.label,
      scopes: record.scopes,
    },
  }
}

export const revokeMcpToken = (
  database: ToolDatabase,
  tokenId: string,
  {
    now = new Date().toISOString(),
    pageId,
  }: {
    now?: string
    pageId: string
  }
) => {
  const result = database
    .prepare(
      `update mcp_tokens
       set revoked_at = ?
       where id = ?
         and page_id = ?
         and revoked_at is null`
    )
    .run(now, tokenId, pageId)

  return result.changes > 0
}

export const listMcpTokens = (
  database: ToolDatabase,
  pageId: string
): McpTokenRecord[] =>
  (
    database
      .prepare(
        `select id,
                page_id as pageId,
                scopes,
                label,
                created_at as createdAt,
                expires_at as expiresAt,
                revoked_at as revokedAt,
                last_used_at as lastUsedAt
         from mcp_tokens
         where page_id = ?
         order by created_at desc`
      )
      .all(pageId) as McpTokenRow[]
  ).map(rowToRecord)

// Fail-closed helper for polled MCP task handles: a task minted by a token
// that has since been revoked or expired must stop yielding results.
export const isMcpTokenActive = (
  database: ToolDatabase,
  tokenId: string,
  now = new Date().toISOString()
) => {
  const row = database
    .prepare(
      `select expires_at as expiresAt,
              revoked_at as revokedAt
       from mcp_tokens
       where id = ?
       limit 1`
    )
    .get(tokenId) as
    | { expiresAt: string | null; revokedAt: string | null }
    | undefined

  if (!row || row.revokedAt) return false

  return !(row.expiresAt && Date.parse(row.expiresAt) <= Date.parse(now))
}

export const touchLastUsed = (
  database: ToolDatabase,
  tokenId: string,
  now = new Date().toISOString()
) => {
  database
    .prepare(
      `update mcp_tokens
       set last_used_at = ?
       where id = ?`
    )
    .run(now, tokenId)
}

export const hashMcpToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const createMcpTokenSecret = () =>
  `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`

const normalizeLabel = (label: string) =>
  label.trim().slice(0, 120) || 'Agent connection'

const normalizeScopes = (scopes: McpAgentScope[]): McpAgentScope[] => {
  const validScopes = new Set<McpAgentScope>([
    'page:read',
    'page:search',
    'page:suggest',
    'page:write',
  ])
  const normalized = scopes.filter((scope): scope is McpAgentScope =>
    validScopes.has(scope)
  )

  return Array.from(new Set(normalized.length ? normalized : ['page:read']))
}

const rowToRecord = (row: McpTokenRow): McpTokenRecord => ({
  id: row.id,
  pageId: row.pageId,
  scopes: normalizeScopes(readJsonScopes(row.scopes)),
  label: row.label,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  lastUsedAt: row.lastUsedAt,
})

const readJsonScopes = (value: string): McpAgentScope[] => {
  try {
    const parsed = JSON.parse(value)

    return Array.isArray(parsed) ? (parsed as McpAgentScope[]) : []
  } catch {
    return []
  }
}
