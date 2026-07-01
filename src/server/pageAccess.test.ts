import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import {
  createPageWithShareLinks,
  regenerateShareToken,
} from './pageRepository.ts'
import {
  getPageSessionFromCookie,
  type PageSession,
} from './shareSessions.ts'
import {
  getPageAccessFromSession,
  handlePageAccessRequest,
  resolvePageHttpAccess,
} from './pageAccess.ts'

const secret = 'test-secret-with-enough-length'
const now = 1_788_888_700_000

test('valid share token creates a signed page session and redirects to the clean page URL', () => {
  const database = createInMemoryDatabase()
  const created = createPageWithShareLinks(database, {
    createToken: () => 'edit-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_share',
  })

  const result = resolvePageHttpAccess({
    database,
    pageId: created.page.id,
    requestUrl:
      'https://cascadery.test/p/page_share?share=edit&token=edit-token',
    secret,
    now,
    createClientId: () => 'client_1',
  })

  assert.equal(result.kind, 'redirect')
  assert.equal(result.location, 'https://cascadery.test/p/page_share')
  assert.match(result.setCookie, /HttpOnly/)
  assert.match(result.setCookie, /SameSite=Lax/)

  const session = getPageSessionFromCookie(
    result.setCookie,
    secret,
    now
  )

  assert.deepEqual(session, {
    accessMode: 'edit',
    clientId: 'client_1',
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    pageId: 'page_share',
    shareLinkUpdatedAt: '2026-06-26T12:00:00.000Z',
  })
})

test('share token redirects preserve forwarded HTTPS origin', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'view-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_forwarded',
  })
  const headers = new Map<string, string | string[]>()
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      headers.set(name, value)
    },
    end() {},
  }

  const handled = handlePageAccessRequest({
    database,
    request: {
      method: 'GET',
      url: '/p/page_forwarded?share=view&token=view-token',
      headers: {
        host: 'internal.fly.dev',
        'x-forwarded-host': 'cascadery.test',
        'x-forwarded-proto': 'https',
      },
    } as never,
    response: response as never,
    secret,
  })

  assert.equal(handled, true)
  assert.equal(response.statusCode, 302)
  assert.equal(
    headers.get('Location'),
    'https://cascadery.test/p/page_forwarded'
  )
  assert.match(String(headers.get('Set-Cookie')), /HttpOnly/)
})

test('page sessions are rejected after that share link is regenerated', () => {
  const database = createInMemoryDatabase()
  const created = createPageWithShareLinks(database, {
    createToken: () => 'old-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_stale',
  })
  const issued = resolvePageHttpAccess({
    database,
    pageId: created.page.id,
    requestUrl:
      'https://cascadery.test/p/page_stale?share=edit&token=old-token',
    secret,
    now,
  })

  assert.equal(issued.kind, 'redirect')

  regenerateShareToken(database, created.page.id, 'edit', {
    createToken: () => 'new-token',
    now: '2026-06-26T13:00:00.000Z',
  })

  const session = getPageSessionFromCookie(
    issued.setCookie,
    secret,
    now
  ) as PageSession

  assert.equal(
    getPageAccessFromSession(database, created.page.id, session),
    null
  )
})

test('view sessions allow page reads but mark collaboration read-only', () => {
  const database = createInMemoryDatabase()
  const created = createPageWithShareLinks(database, {
    createToken: () => 'view-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_view',
  })
  const issued = resolvePageHttpAccess({
    database,
    pageId: created.page.id,
    requestUrl:
      'https://cascadery.test/p/page_view?share=view&token=view-token',
    secret,
    now,
    createClientId: () => 'client_view',
  })

  assert.equal(issued.kind, 'redirect')

  const session = getPageSessionFromCookie(
    issued.setCookie,
    secret,
    now
  ) as PageSession

  assert.deepEqual(
    getPageAccessFromSession(database, created.page.id, session),
    {
      accessMode: 'view',
      clientId: 'client_view',
      pageId: 'page_view',
      readOnly: true,
    }
  )
})

test('invalid tokens and missing sessions fail closed', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'real-token',
    pageId: 'page_forbidden',
  })

  assert.deepEqual(
    resolvePageHttpAccess({
      database,
      pageId: 'page_forbidden',
      requestUrl:
        'https://cascadery.test/p/page_forbidden?share=edit&token=wrong',
      secret,
      now,
    }),
    {
      kind: 'forbidden',
      reason: 'invalid-share-token',
    }
  )

  assert.deepEqual(
    resolvePageHttpAccess({
      database,
      pageId: 'page_forbidden',
      requestUrl: 'https://cascadery.test/p/page_forbidden',
      secret,
      now,
    }),
    {
      kind: 'forbidden',
      reason: 'missing-page-session',
    }
  )
})
