import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCollaborationServer,
  getCollaborationContextFromHeaders,
  getPageIdFromCollaborationDocumentName,
} from './server/collaborationServer.ts'
import { createAuthSession } from './server/auth.ts'
import { createInMemoryDatabase } from './server/database.ts'
import { createPageWithShareLinks } from './server/pageRepository.ts'
import { createPageSessionCookie } from './server/shareSessions.ts'

const secret = 'test-secret-with-enough-length'
const now = 1_788_888_700_000

test('collaboration accepts edit sessions for allowed origins and page documents', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'edit-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_1',
  })
  const cookie = createPageSessionCookie(
    {
      accessMode: 'edit',
      clientId: 'client_1',
      expiresAt: now + 60_000,
      pageId: 'page_1',
      shareLinkUpdatedAt: '2026-06-26T12:00:00.000Z',
    },
    secret,
    now
  )
  const context = getCollaborationContextFromHeaders(
    {
      cookie,
      origin: 'https://tool.test',
    },
    {
      allowedOrigins: ['https://tool.test'],
      database,
      sessionSecret: secret,
      now,
    },
    {
      documentName: 'page:page_1',
    }
  )

  assert.deepEqual(context, {
    accessMode: 'edit',
    clientId: 'client_1',
    pageId: 'page_1',
    readOnly: false,
  })
})

test('collaboration marks view sessions as read-only', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'view-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_2',
  })
  const cookie = createPageSessionCookie(
    {
      accessMode: 'view',
      clientId: 'client_view',
      expiresAt: now + 60_000,
      pageId: 'page_2',
      shareLinkUpdatedAt: '2026-06-26T12:00:00.000Z',
    },
    secret,
    now
  )
  const context = getCollaborationContextFromHeaders(
    new Headers({
      cookie,
      origin: 'https://tool.test',
    }),
    {
      allowedOrigins: ['https://tool.test'],
      database,
      sessionSecret: secret,
      now,
    },
    {
      documentName: 'page:page_2',
    }
  )

  assert.equal(context?.accessMode, 'view')
  assert.equal(context?.pageId, 'page_2')
  assert.equal(context?.readOnly, true)
})

test('collaboration accepts authenticated page owners without share sessions', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    ownerUserId: 'user_owner',
    pageId: 'page_owned_ws',
  })
  const authSession = createAuthSession(database, {
    createToken: () => 'owner-session',
    now: '2026-07-05T12:00:00.000Z',
    user: {
      avatarUrl: null,
      displayName: 'Owner',
      githubId: '1',
      id: 'user_owner',
      login: 'owner',
    },
  })
  const context = getCollaborationContextFromHeaders(
    {
      cookie: authSession.setCookie,
      origin: 'https://tool.test',
    },
    {
      allowedOrigins: ['https://tool.test'],
      database,
      sessionSecret: secret,
      now,
    },
    {
      documentName: 'page:page_owned_ws',
    }
  )

  assert.deepEqual(context, {
    accessMode: 'edit',
    clientId: 'owner_user_owner',
    pageId: 'page_owned_ws',
    readOnly: false,
  })
})

test('collaboration accepts same-origin custom-domain websocket requests when the explicit allowlist is stale', () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'edit-token',
    now: '2026-06-26T12:00:00.000Z',
    pageId: 'page_custom_domain',
  })
  const cookie = createPageSessionCookie(
    {
      accessMode: 'edit',
      clientId: 'client_custom_domain',
      expiresAt: now + 60_000,
      pageId: 'page_custom_domain',
      shareLinkUpdatedAt: '2026-06-26T12:00:00.000Z',
    },
    secret,
    now
  )
  const context = getCollaborationContextFromHeaders(
    {
      cookie,
      host: 'cascadery.com',
      origin: 'https://cascadery.com',
      'x-forwarded-proto': 'https',
    },
    {
      allowedOrigins: ['https://richlaconte-tool.fly.dev'],
      database,
      sessionSecret: secret,
      now,
    },
    {
      documentName: 'page:page_custom_domain',
    }
  )

  assert.equal(context?.pageId, 'page_custom_domain')
  assert.equal(context?.accessMode, 'edit')
})

test('collaboration document names resolve page ids', () => {
  assert.equal(
    getPageIdFromCollaborationDocumentName('page:page_abc'),
    'page_abc'
  )
  assert.equal(getPageIdFromCollaborationDocumentName('page:'), null)
  assert.equal(
    getPageIdFromCollaborationDocumentName('other:page_abc'),
    null
  )
})

test('collaboration rejects disallowed origins, missing sessions, and malformed documents', () => {
  const database = createInMemoryDatabase()
  assert.equal(
    getCollaborationContextFromHeaders(
      {
        origin: 'https://evil.test',
      },
      {
        allowedOrigins: ['https://tool.test'],
        database,
        sessionSecret: secret,
        now,
      },
      {
        documentName: 'page:page_1',
      }
    ),
    null
  )

  assert.equal(
    getCollaborationContextFromHeaders(
      {
        origin: 'https://tool.test',
      },
      {
        allowedOrigins: ['https://tool.test'],
        database,
        sessionSecret: secret,
        now,
      },
      {
        documentName: 'not-a-page',
      }
    ),
    null
  )

  assert.equal(
    getCollaborationContextFromHeaders(
      {
        origin: 'https://tool.test',
      },
      {
        allowedOrigins: ['https://tool.test'],
        database,
        sessionSecret: secret,
        now,
      },
      {
        documentName: 'page:page_1',
      }
    ),
    null
  )
})

test('collaboration server exposes a WebSocket upgrade handler with session config', () => {
  const server = createCollaborationServer({
    databasePath: ':memory:',
    sessionSecret: secret,
  })

  assert.equal(typeof server.handleUpgrade, 'function')
})
