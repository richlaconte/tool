import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import { createPageWithShareLinks } from './pageRepository.ts'
import {
  createPageSnapshotMutation,
  deletePageSnapshotMutation,
  listPageSnapshotsRequest,
  restorePageSnapshotCopyMutation,
} from './pageSnapshotApi.ts'
import { createPageSessionCookie } from './shareSessions.ts'
import { createSnapshot } from './pageSnapshots.ts'
import { saveStoredCollaborativePageState } from './collaborativeStorage.ts'

const secret = 'test-secret-with-enough-length'
const nowMs = 1_788_888_700_000
const now = '2026-07-05T12:00:00.000Z'

const createCookie = (
  pageId: string,
  accessMode: 'edit' | 'view',
  shareLinkUpdatedAt = now
) =>
  createPageSessionCookie(
    {
      accessMode,
      clientId: `client_${accessMode}`,
      expiresAt: nowMs + 60_000,
      pageId,
      shareLinkUpdatedAt,
    },
    secret,
    nowMs
  )

const seedPage = ({
  ownerUserId = null,
}: {
  ownerUserId?: string | null
} = {}) => {
  const database = createInMemoryDatabase()

  createPageWithShareLinks(database, {
    createToken: () => 'token',
    now,
    ownerUserId,
    pageId: 'page_api_snapshots',
    title: 'Snapshot API page',
  })
  saveStoredCollaborativePageState(database, {
    page: {
      id: 'page_api_snapshots',
      title: 'Snapshot API page',
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
    areas: [],
    links: [],
  })

  return database
}

test('view sessions can list snapshots but cannot create them', () => {
  const database = seedPage()

  assert.equal(
    createSnapshot(database, {
      createId: () => 'snapshot-viewable',
      createdBy: {
        displayName: 'Richard',
        userId: null,
      },
      name: 'Viewable',
      now,
      pageId: 'page_api_snapshots',
    }).kind,
    'ok'
  )

  assert.deepEqual(
    listPageSnapshotsRequest({
      cookieHeader: createCookie('page_api_snapshots', 'view'),
      database,
      pageId: 'page_api_snapshots',
      secret,
    }),
    {
      kind: 'ok',
      snapshots: [
        {
          id: 'snapshot-viewable',
          pageId: 'page_api_snapshots',
          name: 'Viewable',
          createdByDisplayName: 'Richard',
          createdByUserId: null,
          createdAt: now,
        },
      ],
    }
  )

  assert.deepEqual(
    createPageSnapshotMutation({
      cookieHeader: createCookie('page_api_snapshots', 'view'),
      createdByDisplayName: 'Viewer',
      database,
      name: 'View snapshot',
      now,
      pageId: 'page_api_snapshots',
      secret,
    }),
    {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  )
})

test('edit sessions can create snapshots and restore them as copies', () => {
  const database = seedPage()

  const created = createPageSnapshotMutation({
    cookieHeader: createCookie('page_api_snapshots', 'edit'),
    createdByDisplayName: 'Editor',
    database,
    name: 'Milestone',
    now,
    pageId: 'page_api_snapshots',
    secret,
  })

  assert.equal(created.kind, 'ok')

  const restored = restorePageSnapshotCopyMutation({
    cookieHeader: createCookie('page_api_snapshots', 'edit'),
    createPageId: () => 'page_api_copy',
    createToken: () => 'copy-token',
    database,
    now,
    pageId: 'page_api_snapshots',
    requestUrl:
      'https://cascadery.test/api/pages/page_api_snapshots/snapshots',
    secret,
    snapshotId: created.kind === 'ok' ? created.snapshot.id : '',
  })

  assert.deepEqual(restored, {
    kind: 'ok',
    pageId: 'page_api_copy',
    editUrl: 'https://cascadery.test/p/page_api_copy?share=edit&token=copy-token',
  })
})

test('owned pages require the owner to delete snapshots', () => {
  const database = seedPage({ ownerUserId: 'user_owner' })
  assert.equal(
    createSnapshot(database, {
      createId: () => 'snapshot-owned',
      createdBy: {
        displayName: 'Owner',
        userId: 'user_owner',
      },
      name: 'Owned',
      now,
      pageId: 'page_api_snapshots',
    }).kind,
    'ok'
  )

  assert.deepEqual(
    deletePageSnapshotMutation({
      authenticatedUserId: null,
      cookieHeader: createCookie('page_api_snapshots', 'edit'),
      database,
      pageId: 'page_api_snapshots',
      secret,
      snapshotId: 'snapshot-owned',
    }),
    {
      kind: 'forbidden',
      reason: 'owner-required',
    }
  )

  assert.deepEqual(
    deletePageSnapshotMutation({
      authenticatedUserId: 'user_owner',
      cookieHeader: createCookie('page_api_snapshots', 'edit'),
      database,
      pageId: 'page_api_snapshots',
      secret,
      snapshotId: 'snapshot-owned',
    }),
    {
      kind: 'ok',
    }
  )
})
