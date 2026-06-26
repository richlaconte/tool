import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCollaborationServer,
  getCollaborationContextFromHeaders,
  getPageIdFromCollaborationDocumentName,
} from './server/collaborationServer.ts'

test('anonymous collaboration accepts allowed origins and page documents', () => {
  const context = getCollaborationContextFromHeaders(
    {
      origin: 'https://tool.test',
    },
    {
      allowedOrigins: ['https://tool.test'],
    },
    {
      clientId: 'client_1',
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

test('anonymous collaboration accepts Web Headers objects without cookies', () => {
  const context = getCollaborationContextFromHeaders(
    new Headers({
      origin: 'https://tool.test',
    }),
    {
      allowedOrigins: ['https://tool.test'],
    },
    {
      documentName: 'page:page_2',
    }
  )

  assert.equal(context?.accessMode, 'edit')
  assert.equal(context?.pageId, 'page_2')
  assert.equal(context?.readOnly, false)
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

test('anonymous collaboration rejects disallowed origins and malformed documents', () => {
  assert.equal(
    getCollaborationContextFromHeaders(
      {
        origin: 'https://evil.test',
      },
      {
        allowedOrigins: ['https://tool.test'],
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
      },
      {
        documentName: 'not-a-page',
      }
    ),
    null
  )
})

test('collaboration server exposes a WebSocket upgrade handler without session config', () => {
  const server = createCollaborationServer({
    databasePath: ':memory:',
  })

  assert.equal(typeof server.handleUpgrade, 'function')
})
