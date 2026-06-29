import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import { createPageWithShareLinks, validateShareToken } from './pageRepository.ts'
import { createPageSessionCookie, getPageSessionFromCookie } from './shareSessions.ts'
import { createShareLinkMutation } from './shareLinkApi.ts'

const secret = 'test-secret-with-enough-length'
const now = 1_788_888_700_000
const createdAt = '2026-06-26T12:00:00.000Z'
const updatedAt = '2026-06-26T13:00:00.000Z'

const createEditSessionCookie = (pageId: string) =>
  createPageSessionCookie(
    {
      accessMode: 'edit',
      clientId: 'client_edit',
      expiresAt: now + 60_000,
      pageId,
      shareLinkUpdatedAt: createdAt,
    },
    secret,
    now
  )

test('edit sessions can create a real server-backed share URL', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'old-token',
    now: createdAt,
    pageId: 'page_share_api',
  })

  const result = createShareLinkMutation({
    accessMode: 'view',
    cookieHeader: createEditSessionCookie('page_share_api'),
    createToken: () => 'new-view-token',
    database,
    now: updatedAt,
    pageId: 'page_share_api',
    requestUrl:
      'https://cascadery.test/api/pages/page_share_api/share-links',
    secret,
  })

  assert.deepEqual(result, {
    kind: 'ok',
    accessMode: 'view',
    setCookie: null,
    url: 'https://cascadery.test/p/page_share_api?share=view&token=new-view-token',
  })
  assert.deepEqual(
    validateShareToken(
      database,
      'page_share_api',
      'view',
      'new-view-token'
    ),
    {
      accessMode: 'view',
      pageId: 'page_share_api',
      shareLinkUpdatedAt: updatedAt,
    }
  )
})

test('regenerating an edit link refreshes the current edit session cookie', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'old-token',
    now: createdAt,
    pageId: 'page_edit_link',
  })

  const result = createShareLinkMutation({
    accessMode: 'edit',
    cookieHeader: createEditSessionCookie('page_edit_link'),
    createToken: () => 'new-edit-token',
    database,
    now: updatedAt,
    pageId: 'page_edit_link',
    requestUrl:
      'https://cascadery.test/api/pages/page_edit_link/share-links',
    secret,
  })

  assert.equal(result.kind, 'ok')
  assert.equal(
    result.url,
    'https://cascadery.test/p/page_edit_link?share=edit&token=new-edit-token'
  )
  assert.match(result.setCookie ?? '', /HttpOnly/)

  const session = getPageSessionFromCookie(
    result.setCookie ?? '',
    secret,
    Date.parse(updatedAt)
  )

  assert.equal(session?.accessMode, 'edit')
  assert.equal(session?.clientId, 'client_edit')
  assert.equal(session?.shareLinkUpdatedAt, updatedAt)
})

test('view sessions and invalid access modes cannot create share URLs', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'old-token',
    now: createdAt,
    pageId: 'page_view_forbidden',
  })
  const viewCookie = createPageSessionCookie(
    {
      accessMode: 'view',
      clientId: 'client_view',
      expiresAt: now + 60_000,
      pageId: 'page_view_forbidden',
      shareLinkUpdatedAt: createdAt,
    },
    secret,
    now
  )

  assert.deepEqual(
    createShareLinkMutation({
      accessMode: 'view',
      cookieHeader: viewCookie,
      database,
      now: updatedAt,
      pageId: 'page_view_forbidden',
      requestUrl:
        'https://cascadery.test/api/pages/page_view_forbidden/share-links',
      secret,
    }),
    {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  )

  assert.deepEqual(
    createShareLinkMutation({
      accessMode: 'delete',
      cookieHeader: createEditSessionCookie('page_view_forbidden'),
      database,
      now: updatedAt,
      pageId: 'page_view_forbidden',
      requestUrl:
        'https://cascadery.test/api/pages/page_view_forbidden/share-links',
      secret,
    }),
    {
      kind: 'bad-request',
      reason: 'invalid-access-mode',
    }
  )
})
