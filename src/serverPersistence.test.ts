import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './server/database.ts'
import {
  createPageWithShareLinks,
  regenerateShareToken,
  validateShareToken,
} from './server/pageRepository.ts'
import {
  createPageSessionCookie,
  getPageSessionFromCookie,
} from './server/shareSessions.ts'

test('creates a page with edit and view links while storing only token hashes', () => {
  const db = createInMemoryDatabase()
  const tokens = ['edit-token', 'view-token']
  const created = createPageWithShareLinks(db, {
    createToken: () => tokens.shift() ?? 'missing-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_1',
    title: 'Planning board',
  })

  assert.equal(created.page.id, 'page_1')
  assert.equal(created.page.title, 'Planning board')
  assert.equal(created.editToken, 'edit-token')
  assert.equal(created.viewToken, 'view-token')

  const rows = db
    .prepare('select mode, token_hash from share_links order by mode')
    .all() as Array<{ mode: string; token_hash: string }>

  assert.deepEqual(
    rows.map((row) => row.mode),
    ['edit', 'view']
  )
  assert.notEqual(rows[0].token_hash, 'edit-token')
  assert.notEqual(rows[1].token_hash, 'view-token')

  assert.deepEqual(validateShareToken(db, 'page_1', 'edit', 'edit-token'), {
    pageId: 'page_1',
    accessMode: 'edit',
  })
  assert.deepEqual(validateShareToken(db, 'page_1', 'view', 'view-token'), {
    pageId: 'page_1',
    accessMode: 'view',
  })
  assert.equal(validateShareToken(db, 'page_1', 'edit', 'wrong-token'), null)
})

test('regenerates one share token without changing the other mode', () => {
  const db = createInMemoryDatabase()
  const created = createPageWithShareLinks(db, {
    createToken: () => 'old-token',
    pageId: 'page_2',
  })

  const regenerated = regenerateShareToken(db, 'page_2', 'edit', {
    createToken: () => 'new-edit-token',
    now: '2026-06-26T13:00:00.000Z',
  })

  assert.equal(regenerated.token, 'new-edit-token')
  assert.equal(validateShareToken(db, 'page_2', 'edit', created.editToken), null)
  assert.deepEqual(
    validateShareToken(db, 'page_2', 'edit', 'new-edit-token'),
    {
      pageId: 'page_2',
      accessMode: 'edit',
    }
  )
  assert.deepEqual(
    validateShareToken(db, 'page_2', 'view', created.viewToken),
    {
      pageId: 'page_2',
      accessMode: 'view',
    }
  )
})

test('signed page session cookies parse, expire, and reject tampering', () => {
  const secret = 'test-secret-with-enough-length'
  const cookie = createPageSessionCookie(
    {
      accessMode: 'edit',
      clientId: 'client_1',
      expiresAt: 1_788_888_800_000,
      pageId: 'page_3',
    },
    secret
  )

  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)

  assert.deepEqual(
    getPageSessionFromCookie(cookie, secret, 1_788_888_700_000),
    {
      accessMode: 'edit',
      clientId: 'client_1',
      expiresAt: 1_788_888_800_000,
      pageId: 'page_3',
    }
  )
  assert.equal(
    getPageSessionFromCookie(cookie, secret, 1_788_888_900_000),
    null
  )
  assert.equal(
    getPageSessionFromCookie(
      cookie.replace('tool.pageSession=', 'tool.pageSession=A'),
      secret,
      1_788_888_700_000
    ),
    null
  )
})
