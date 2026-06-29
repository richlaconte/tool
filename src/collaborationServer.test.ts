import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCollaborationServer,
  getCollaborationContextFromHeaders,
  getPageIdFromCollaborationDocumentName,
} from './server/collaborationServer.ts'
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
