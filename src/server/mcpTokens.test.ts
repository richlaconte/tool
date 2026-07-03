import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import { createPageWithShareLinks } from './pageRepository.ts'
import {
  listMcpTokens,
  mintMcpToken,
  revokeMcpToken,
  validateMcpToken,
} from './mcpTokens.ts'

const now = '2026-07-02T12:00:00.000Z'
const later = '2026-07-02T13:00:00.000Z'

test('MCP tokens are stored hashed and validate into scoped agent clients', () => {
  const database = createInMemoryDatabase()
  createPage(database, 'page-1')
  const minted = mintMcpToken(database, {
    createToken: () => 'cscd_plain-token',
    expiresAt: '2026-08-02T12:00:00.000Z',
    label: 'Claude Code on laptop',
    now,
    pageId: 'page-1',
    scopes: ['page:read', 'page:suggest'],
  })

  assert.equal(minted.token, 'cscd_plain-token')
  assert.equal(minted.record.tokenHash, undefined)
  assert.equal(minted.record.lastUsedAt, null)
  assert.deepEqual(minted.record.scopes, ['page:read', 'page:suggest'])

  const raw = database
    .prepare('select token_hash as tokenHash from mcp_tokens where id = ?')
    .get(minted.record.id) as { tokenHash: string }

  assert.notEqual(raw.tokenHash, minted.token)
  assert.match(raw.tokenHash, /^[a-f0-9]{64}$/)

  const validation = validateMcpToken(database, minted.token, {
    now: later,
    pageId: 'page-1',
  })

  assert.equal(validation.ok, true)
  assert.equal(validation.ok ? validation.token.id : null, minted.record.id)
  assert.deepEqual(validation.ok ? validation.client : null, {
    id: minted.record.id,
    displayName: 'Claude Code on laptop',
    scopes: ['page:read', 'page:suggest'],
  })
  assert.equal(listMcpTokens(database, 'page-1')[0].lastUsedAt, later)
})

test('MCP token validation fails closed for wrong page, expiry, and revocation', () => {
  const database = createInMemoryDatabase()
  createPage(database, 'page-1')
  const minted = mintMcpToken(database, {
    createToken: () => 'cscd_expiring-token',
    expiresAt: '2026-07-02T12:30:00.000Z',
    label: 'Cursor',
    now,
    pageId: 'page-1',
    scopes: ['page:read'],
  })

  assert.deepEqual(
    validateMcpToken(database, minted.token, {
      now,
      pageId: 'page-2',
    }),
    {
      ok: false,
      reason: 'wrong-page',
      tokenId: minted.record.id,
      pageId: 'page-1',
    }
  )
  assert.deepEqual(
    validateMcpToken(database, minted.token, {
      now: '2026-07-02T12:31:00.000Z',
      pageId: 'page-1',
    }),
    {
      ok: false,
      reason: 'expired',
      tokenId: minted.record.id,
      pageId: 'page-1',
    }
  )

  const perpetual = mintMcpToken(database, {
    createToken: () => 'cscd_revoked-token',
    expiresAt: null,
    label: 'Revoked',
    now,
    pageId: 'page-1',
    scopes: ['page:read'],
  })

  revokeMcpToken(database, perpetual.record.id, {
    now: later,
    pageId: 'page-1',
  })

  assert.deepEqual(
    validateMcpToken(database, perpetual.token, {
      now: later,
      pageId: 'page-1',
    }),
    {
      ok: false,
      reason: 'revoked',
      tokenId: perpetual.record.id,
      pageId: 'page-1',
    }
  )
})

const createPage = (database: ReturnType<typeof createInMemoryDatabase>, pageId: string) => {
  createPageWithShareLinks(database, {
    createToken: () => `share-${pageId}`,
    now,
    pageId,
  })
}
