import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import { createPageWithShareLinks, getPageRecord } from './pageRepository.ts'
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  restoreSnapshotAsCopy,
  SNAPSHOT_LIMIT_PER_PAGE,
} from './pageSnapshots.ts'
import {
  getStoredCollaborativePageState,
  saveStoredCollaborativePageState,
} from './collaborativeStorage.ts'
import { parsePageJson } from '../pagePersistence.ts'

const now = '2026-07-05T12:00:00.000Z'

const seedPage = () => {
  const database = createInMemoryDatabase()
  createPageWithShareLinks(database, {
    createToken: () => 'token',
    now,
    pageId: 'page_snapshots',
    title: 'Snapshot page',
  })
  saveStoredCollaborativePageState(database, {
    page: {
      id: 'page_snapshots',
      title: 'Snapshot page',
      createdAt: now,
      updatedAt: now,
      settings: {
        background: '#ffffff',
        snapGrid: {
          enabled: false,
          size: 16,
          visible: false,
        },
        theme: {
          colors: [],
        },
        mcp: {
          enabled: false,
          autoAcceptStatusUpdates: false,
        },
        shareLinks: null,
      },
    },
    assets: [],
    areas: [
      {
        id: 'area-1',
        parentId: null,
        x: 20,
        y: 30,
        width: 240,
        height: 120,
        text: 'Snapshot me',
        styles: {
          border: '1px solid #2563eb',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    links: [],
  })

  return database
}

test('creates, lists, gets, and deletes named page snapshots', () => {
  const database = seedPage()

  const created = createSnapshot(database, {
    createId: () => 'snapshot-1',
    createdBy: {
      displayName: 'Richard',
      userId: null,
    },
    name: ' v1 approved ',
    now,
    pageId: 'page_snapshots',
  })

  assert.equal(created.kind, 'ok')
  assert.deepEqual(listSnapshots(database, 'page_snapshots'), [
    {
      id: 'snapshot-1',
      pageId: 'page_snapshots',
      name: 'v1 approved',
      createdByDisplayName: 'Richard',
      createdByUserId: null,
      createdAt: now,
    },
  ])

  const snapshot = getSnapshot(database, 'page_snapshots', 'snapshot-1')
  assert.equal(snapshot?.name, 'v1 approved')
  assert.equal(parsePageJson(snapshot?.stateJson ?? '').ok, true)

  assert.equal(deleteSnapshot(database, 'page_snapshots', 'snapshot-1'), true)
  assert.deepEqual(listSnapshots(database, 'page_snapshots'), [])
})

test('createSnapshot refuses the 51st named snapshot with a clear error', () => {
  const database = seedPage()

  for (let index = 0; index < SNAPSHOT_LIMIT_PER_PAGE; index += 1) {
    assert.equal(
      createSnapshot(database, {
        createId: () => `snapshot-${index}`,
        createdBy: {
          displayName: 'Richard',
          userId: null,
        },
        name: `Snapshot ${index}`,
        now,
        pageId: 'page_snapshots',
      }).kind,
      'ok'
    )
  }

  assert.deepEqual(
    createSnapshot(database, {
      createId: () => 'snapshot-overflow',
      createdBy: {
        displayName: 'Richard',
        userId: null,
      },
      name: 'Overflow',
      now,
      pageId: 'page_snapshots',
    }),
    {
      kind: 'limit-reached',
      reason:
        'This page already has 50 named snapshots. Delete one before creating another.',
    }
  )
})

test('restoreSnapshotAsCopy creates a new page seeded from the snapshot state', () => {
  const database = seedPage()
  const created = createSnapshot(database, {
    createId: () => 'snapshot-copy',
    createdBy: {
      displayName: 'Richard',
      userId: null,
    },
    name: 'Before review',
    now,
    pageId: 'page_snapshots',
  })

  assert.equal(created.kind, 'ok')

  const restored = restoreSnapshotAsCopy(database, {
    createPageId: () => 'page_restored',
    createToken: () => 'restored-token',
    now: '2026-07-05T13:00:00.000Z',
    ownerUserId: 'user-owner',
    pageId: 'page_snapshots',
    requestUrl: 'https://cascadery.test/api/pages/page_snapshots/snapshots/snapshot-copy',
    snapshotId: 'snapshot-copy',
  })

  assert.equal(restored.kind, 'ok')
  assert.equal(
    restored.editUrl,
    'https://cascadery.test/p/page_restored?share=edit&token=restored-token'
  )
  assert.equal(getPageRecord(database, 'page_restored')?.title, 'Snapshot page copy')
  assert.equal(
    getStoredCollaborativePageState(database, 'page_restored')?.areas[0]
      ?.id,
    'area-1'
  )
  assert.equal(
    getStoredCollaborativePageState(database, 'page_snapshots')?.page.id,
    'page_snapshots'
  )
})
