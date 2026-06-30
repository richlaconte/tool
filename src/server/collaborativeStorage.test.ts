import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import * as Y from 'yjs'

import { createCollaborativePageDoc } from '../collaborativePage.ts'
import { createDefaultPageState, type PageAppState } from '../pagePersistence.ts'
import {
  getStoredCollaborativePageState,
  setupCollaborativeDocumentStorage,
} from './collaborativeStorage.ts'

const now = '2026-06-26T12:00:00.000Z'

test('collaborative storage reads current page state from a Yjs document row', () => {
  const database = new Database(':memory:')
  const state: PageAppState = {
    page: createDefaultPageState({
      id: 'page-1',
      now,
    }),
    assets: [],
    areas: [
      {
        id: 'area-1',
        parentId: null,
        x: 20,
        y: 40,
        width: 260,
        height: 120,
        text: 'Decision: MCP reads collaboration state.',
        metadata: {
          kind: 'decision',
          status: 'decided',
          tags: ['mcp'],
          filePath: 'src/server/collaborativeStorage.ts',
        },
        styles: {
          border: '1px solid #2563eb',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    links: [
      {
        id: 'link-1',
        fromAreaId: 'area-1',
        toAreaId: 'area-1',
        kind: 'references',
        label: 'self reference',
        visual: {
          mode: 'semantic',
          direction: 'forward',
          route: 'auto',
          labelVisibility: 'auto',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
  const doc = createCollaborativePageDoc(state)

  setupCollaborativeDocumentStorage(database)
  database
    .prepare('insert into documents (name, data) values (?, ?)')
    .run('page:page-1', Buffer.from(Y.encodeStateAsUpdate(doc)))

  const storedState = getStoredCollaborativePageState(database, 'page-1')

  assert.equal(storedState?.page.id, 'page-1')
  assert.equal(storedState?.areas[0].id, 'area-1')
  assert.equal(
    storedState?.areas[0].type === 'image'
      ? ''
      : storedState?.areas[0].text,
    'Decision: MCP reads collaboration state.'
  )
  assert.deepEqual(storedState?.areas[0].metadata, {
    kind: 'decision',
    status: 'decided',
    tags: ['mcp'],
    filePath: 'src/server/collaborativeStorage.ts',
  })
  assert.deepEqual(storedState?.links, state.links)
})

test('collaborative storage returns null when a page document is missing', () => {
  const database = new Database(':memory:')

  setupCollaborativeDocumentStorage(database)

  assert.equal(getStoredCollaborativePageState(database, 'missing'), null)
})
