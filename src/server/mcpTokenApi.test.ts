import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import {
  createMcpTokenConnection,
  listMcpTokenConnections,
} from './mcpTokenApi.ts'
import { createPageWithShareLinks } from './pageRepository.ts'
import { createPageSessionCookie } from './shareSessions.ts'

const secret = 'test-secret-with-enough-length'
const nowMs = 1_788_888_700_000
const now = '2026-07-05T12:00:00.000Z'

const createEditSessionCookie = (pageId: string) =>
  createPageSessionCookie(
    {
      accessMode: 'edit',
      clientId: 'client_edit',
      expiresAt: nowMs + 60_000,
      pageId,
      shareLinkUpdatedAt: now,
    },
    secret,
    nowMs
  )

test('owned pages require the owner to manage MCP tokens', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'share-token',
    now,
    ownerUserId: 'user_owner',
    pageId: 'page_owned_mcp',
  })

  assert.deepEqual(
    listMcpTokenConnections({
      authenticatedUserId: null,
      cookieHeader: createEditSessionCookie('page_owned_mcp'),
      database,
      now: nowMs,
      pageId: 'page_owned_mcp',
      secret,
    }),
    {
      kind: 'forbidden',
      reason: 'owner-required',
    }
  )

  const result = createMcpTokenConnection({
    authenticatedUserId: 'user_owner',
    cookieHeader: createEditSessionCookie('page_owned_mcp'),
    database,
    label: 'Local agent',
    now,
    pageId: 'page_owned_mcp',
    scopes: ['page:read'],
    secret,
  })

  assert.equal(result.kind, 'ok')
  assert.equal(result.tokens.length, 1)
})
