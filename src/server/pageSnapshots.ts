import { randomUUID } from 'node:crypto'

import type { ToolDatabase } from './database.ts'
import {
  createPageWithShareLinks,
  getPageRecord,
} from './pageRepository.ts'
import {
  getStoredCollaborativePageState,
  saveStoredCollaborativePageState,
  type StoredPageState,
} from './collaborativeStorage.ts'

export const SNAPSHOT_LIMIT_PER_PAGE = 50

export type PageSnapshotMetadata = {
  id: string
  pageId: string
  name: string
  createdByDisplayName: string | null
  createdByUserId: string | null
  createdAt: string
}

export type PageSnapshotRecord = PageSnapshotMetadata & {
  stateJson: string
}

export type CreateSnapshotResult =
  | {
      kind: 'ok'
      snapshot: PageSnapshotRecord
    }
  | {
      kind: 'not-found'
      reason: 'page-state-not-found'
    }
  | {
      kind: 'bad-request'
      reason: 'snapshot-name-required' | 'snapshot-name-too-long'
    }
  | {
      kind: 'limit-reached'
      reason: string
    }

export type RestoreSnapshotAsCopyResult =
  | {
      kind: 'ok'
      pageId: string
      editUrl: string
    }
  | {
      kind: 'not-found'
      reason: 'snapshot-not-found'
    }
  | {
      kind: 'invalid-snapshot'
      reason: 'snapshot-state-invalid'
    }

export const createSnapshot = (
  database: ToolDatabase,
  {
    createId = () => `snapshot_${randomUUID()}`,
    createdBy,
    name,
    now = new Date().toISOString(),
    pageId,
  }: {
    createId?: () => string
    createdBy: {
      displayName: string | null
      userId?: string | null
    }
    name: string
    now?: string
    pageId: string
  }
): CreateSnapshotResult => {
  const snapshotName = name.trim()

  if (!snapshotName) {
    return {
      kind: 'bad-request',
      reason: 'snapshot-name-required',
    }
  }

  if (snapshotName.length > 80) {
    return {
      kind: 'bad-request',
      reason: 'snapshot-name-too-long',
    }
  }

  const snapshotCount = database
    .prepare('select count(*) as count from page_snapshots where page_id = ?')
    .get(pageId) as { count: number }

  if (snapshotCount.count >= SNAPSHOT_LIMIT_PER_PAGE) {
    return {
      kind: 'limit-reached',
      reason:
        'This page already has 50 named snapshots. Delete one before creating another.',
    }
  }

  const state = getStoredCollaborativePageState(database, pageId)

  if (!state) {
    return {
      kind: 'not-found',
      reason: 'page-state-not-found',
    }
  }

  const snapshot: PageSnapshotRecord = {
    id: createId(),
    pageId,
    name: snapshotName,
    createdByDisplayName: createdBy.displayName,
    createdByUserId: createdBy.userId ?? null,
    createdAt: now,
    stateJson: stringifyStoredPageState(state, now),
  }

  database
    .prepare(
      `insert into page_snapshots
        (id, page_id, name, created_by_display_name, created_by_user_id,
         created_at, state_json)
       values (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      snapshot.id,
      snapshot.pageId,
      snapshot.name,
      snapshot.createdByDisplayName,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.stateJson
    )

  return {
    kind: 'ok',
    snapshot,
  }
}

export const listSnapshots = (
  database: ToolDatabase,
  pageId: string
): PageSnapshotMetadata[] =>
  database
    .prepare(
      `select id, page_id as pageId, name,
              created_by_display_name as createdByDisplayName,
              created_by_user_id as createdByUserId,
              created_at as createdAt
       from page_snapshots
       where page_id = ?
       order by created_at desc, id desc`
    )
    .all(pageId) as PageSnapshotMetadata[]

export const getSnapshot = (
  database: ToolDatabase,
  pageId: string,
  snapshotId: string
): PageSnapshotRecord | null =>
  (database
    .prepare(
      `select id, page_id as pageId, name,
              created_by_display_name as createdByDisplayName,
              created_by_user_id as createdByUserId,
              created_at as createdAt,
              state_json as stateJson
       from page_snapshots
       where page_id = ?
         and id = ?
       limit 1`
    )
    .get(pageId, snapshotId) as PageSnapshotRecord | undefined) ?? null

export const deleteSnapshot = (
  database: ToolDatabase,
  pageId: string,
  snapshotId: string
) => {
  const result = database
    .prepare('delete from page_snapshots where page_id = ? and id = ?')
    .run(pageId, snapshotId)

  return result.changes === 1
}

export const restoreSnapshotAsCopy = (
  database: ToolDatabase,
  {
    createPageId,
    createToken,
    now = new Date().toISOString(),
    ownerUserId = null,
    pageId,
    requestUrl,
    snapshotId,
  }: {
    createPageId?: () => string
    createToken?: () => string
    now?: string
    ownerUserId?: string | null
    pageId: string
    requestUrl: string
    snapshotId: string
  }
): RestoreSnapshotAsCopyResult => {
  const snapshot = getSnapshot(database, pageId, snapshotId)

  if (!snapshot) {
    return {
      kind: 'not-found',
      reason: 'snapshot-not-found',
    }
  }

  const parsed = parseStoredSnapshotState(snapshot.stateJson)

  if (!parsed) {
    return {
      kind: 'invalid-snapshot',
      reason: 'snapshot-state-invalid',
    }
  }

  const sourcePage = getPageRecord(database, pageId)
  const pageIdForCopy = createPageId?.() ?? `page_${randomUUID()}`
  const created = createPageWithShareLinks(database, {
    createToken,
    now,
    ownerUserId,
    pageId: pageIdForCopy,
    title: `${sourcePage?.title ?? parsed.page.title} copy`,
  })
  const restoredState: StoredPageState = {
    ...parsed,
    page: {
      ...parsed.page,
      id: created.page.id,
      title: created.page.title,
      createdAt: created.page.createdAt,
      updatedAt: created.page.updatedAt,
      settings: {
        ...parsed.page.settings,
        shareLinks: null,
      },
    },
  }

  saveStoredCollaborativePageState(database, restoredState)

  const editUrl = new URL(`/p/${created.page.id}`, requestUrl)
  editUrl.searchParams.set('share', 'edit')
  editUrl.searchParams.set('token', created.editToken)

  return {
    kind: 'ok',
    pageId: created.page.id,
    editUrl: editUrl.toString(),
  }
}

const stringifyStoredPageState = (state: StoredPageState, now: string) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      page: {
        ...state.page,
        updatedAt: now,
        settings: {
          ...state.page.settings,
          shareLinks: null,
        },
      },
      areas: state.areas.map((area) =>
        area.type === 'image'
          ? {
              ...area,
              type: 'image',
              createdAt: area.createdAt ?? now,
              updatedAt: area.updatedAt ?? now,
            }
          : {
              ...area,
              type: 'text',
              createdAt: area.createdAt ?? now,
              updatedAt: area.updatedAt ?? now,
            }
      ),
      assets: state.assets.map((asset) => ({ ...asset })),
      ...(state.links.length > 0
        ? {
            links: state.links.map((link) => ({ ...link })),
          }
        : {}),
      ...(state.journal && state.journal.length > 0
        ? {
            journal: state.journal.map((entry) => ({ ...entry })),
          }
        : {}),
    },
    null,
    2
  )}\n`

const parseStoredSnapshotState = (json: string): StoredPageState | null => {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    return null
  }

  if (!isRecord(value) || value.schemaVersion !== 1) return null
  if (
    !isRecord(value.page) ||
    !Array.isArray(value.areas) ||
    !Array.isArray(value.assets)
  ) {
    return null
  }

  const page = value.page as StoredPageState['page']

  return {
    page: {
      ...page,
      settings: {
        ...page.settings,
        shareLinks: null,
      },
    },
    areas: value.areas as StoredPageState['areas'],
    assets: value.assets as StoredPageState['assets'],
    links: Array.isArray(value.links)
      ? (value.links as StoredPageState['links'])
      : [],
    journal: Array.isArray(value.journal)
      ? (value.journal as StoredPageState['journal'])
      : [],
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
