import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import {
  claimPage,
  createPageWithShareLinks,
  deletePage,
  getPageRecord,
  listPages,
  revokeShareToken,
  validateShareToken,
} from './pageRepository.ts'

const now = '2026-07-05T12:00:00.000Z'
const later = '2026-07-05T13:00:00.000Z'

test('pages can be owned and listed by owner newest first', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    now,
    ownerUserId: 'user_1',
    pageId: 'page_old',
    title: 'Old',
  })
  createPageWithShareLinks(database, {
    now: later,
    ownerUserId: 'user_2',
    pageId: 'page_other',
    title: 'Other',
  })
  createPageWithShareLinks(database, {
    now: later,
    ownerUserId: 'user_1',
    pageId: 'page_new',
    title: 'New',
  })

  assert.deepEqual(
    listPages(database, { ownerUserId: 'user_1' }).map((page) => ({
      id: page.id,
      ownerUserId: page.ownerUserId,
      title: page.title,
    })),
    [
      { id: 'page_new', ownerUserId: 'user_1', title: 'New' },
      { id: 'page_old', ownerUserId: 'user_1', title: 'Old' },
    ]
  )
})

test('claiming an anonymous page is atomic and first writer wins', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    now,
    pageId: 'page_claim',
  })

  assert.equal(
    claimPage(database, 'page_claim', 'user_1', { now: later }),
    true
  )
  assert.equal(
    claimPage(database, 'page_claim', 'user_2', { now: later }),
    false
  )
  assert.equal(getPageRecord(database, 'page_claim')?.ownerUserId, 'user_1')
})

test('revoking and deleting pages fail closed for share tokens and sessions', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'share-token',
    now,
    pageId: 'page_delete',
  })

  assert.equal(
    validateShareToken(database, 'page_delete', 'view', 'share-token')?.pageId,
    'page_delete'
  )

  revokeShareToken(database, 'page_delete', 'view', { now: later })
  assert.equal(
    validateShareToken(database, 'page_delete', 'view', 'share-token'),
    null
  )

  assert.equal(
    validateShareToken(database, 'page_delete', 'edit', 'share-token')?.pageId,
    'page_delete'
  )
  assert.equal(deletePage(database, 'page_delete', { now: later }), true)
  assert.equal(getPageRecord(database, 'page_delete'), null)
  assert.equal(listPages(database).some((page) => page.id === 'page_delete'), false)
  assert.equal(
    validateShareToken(database, 'page_delete', 'edit', 'share-token'),
    null
  )
})
