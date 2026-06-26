import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildShareUrl,
  createShareLinks,
  getShareAccessMode,
  regenerateShareLink,
} from './shareLinks.ts'

const now = '2026-06-26T12:00:00.000Z'

test('creates distinct unguessable edit and view tokens', () => {
  const links = createShareLinks('page-1', now)

  assert.equal(links.pageId, 'page-1')
  assert.equal(links.revokedAt, null)
  assert.notEqual(links.editToken, links.viewToken)
  assert.match(links.editToken, /^[A-Za-z0-9_-]{43,}$/)
  assert.match(links.viewToken, /^[A-Za-z0-9_-]{43,}$/)
})

test('builds share URLs without embedding page content', () => {
  assert.equal(
    buildShareUrl('https://example.test/canvas?old=true', 'view', 'abc 123'),
    'https://example.test/canvas?share=view&token=abc+123'
  )
})

test('resolves share access from valid tokens and fails closed for invalid share URLs', () => {
  const links = {
    ...createShareLinks('page-1', now),
    editToken: 'edit-token',
    viewToken: 'view-token',
  }

  assert.equal(getShareAccessMode('', links), 'edit')
  assert.equal(
    getShareAccessMode('?share=edit&token=edit-token', links),
    'edit'
  )
  assert.equal(
    getShareAccessMode('?share=view&token=view-token', links),
    'view'
  )
  assert.equal(
    getShareAccessMode('?share=edit&token=wrong-token', links),
    'view'
  )
})

test('regenerates one link without changing the other token', () => {
  const links = {
    ...createShareLinks('page-1', now),
    editToken: 'old-edit-token',
    viewToken: 'stable-view-token',
  }
  const updatedLinks = regenerateShareLink(links, 'edit', now)

  assert.notEqual(updatedLinks.editToken, links.editToken)
  assert.equal(updatedLinks.viewToken, links.viewToken)
  assert.equal(updatedLinks.updatedAt, now)
})
