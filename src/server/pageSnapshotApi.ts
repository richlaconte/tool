import type { ToolDatabase } from './database.ts'
import { getPageRecord } from './pageRepository.ts'
import {
  getPageAccessFromAuthenticatedUser,
  getPageAccessFromSession,
} from './pageAccess.ts'
import { getPageSessionFromCookie } from './shareSessions.ts'
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  restoreSnapshotAsCopy,
  type CreateSnapshotResult,
  type PageSnapshotMetadata,
  type PageSnapshotRecord,
  type RestoreSnapshotAsCopyResult,
} from './pageSnapshots.ts'

type ForbiddenResult = {
  kind: 'forbidden'
  reason: 'page-session-required' | 'edit-session-required' | 'owner-required'
}

export type ListPageSnapshotsResult =
  | {
      kind: 'ok'
      snapshots: PageSnapshotMetadata[]
    }
  | ForbiddenResult

export type GetPageSnapshotResult =
  | {
      kind: 'ok'
      snapshot: PageSnapshotRecord
    }
  | {
      kind: 'not-found'
      reason: 'snapshot-not-found'
    }
  | ForbiddenResult

export type CreatePageSnapshotMutationResult =
  | CreateSnapshotResult
  | ForbiddenResult

export type DeletePageSnapshotMutationResult =
  | {
      kind: 'ok'
    }
  | {
      kind: 'not-found'
      reason: 'snapshot-not-found'
    }
  | ForbiddenResult

export type RestorePageSnapshotCopyMutationResult =
  | RestoreSnapshotAsCopyResult
  | ForbiddenResult

type AccessOptions = {
  authenticatedUserId?: string | null
  cookieHeader?: string
  database: ToolDatabase
  pageId: string
  secret: string
}

export const listPageSnapshotsRequest = ({
  database,
  pageId,
  ...accessOptions
}: AccessOptions): ListPageSnapshotsResult => {
  const access = resolveSnapshotAccess({
    database,
    pageId,
    ...accessOptions,
  })

  if (!access) {
    return {
      kind: 'forbidden',
      reason: 'page-session-required',
    }
  }

  return {
    kind: 'ok',
    snapshots: listSnapshots(database, pageId),
  }
}

export const getPageSnapshotRequest = ({
  database,
  pageId,
  secret,
  snapshotId,
  ...accessOptions
}: AccessOptions & {
  snapshotId: string
}): GetPageSnapshotResult => {
  const access = resolveSnapshotAccess({
    database,
    pageId,
    secret,
    ...accessOptions,
  })

  if (!access) {
    return {
      kind: 'forbidden',
      reason: 'page-session-required',
    }
  }

  const snapshot = getSnapshot(database, pageId, snapshotId)

  return snapshot
    ? {
        kind: 'ok',
        snapshot,
      }
    : {
        kind: 'not-found',
        reason: 'snapshot-not-found',
      }
}

export const createPageSnapshotMutation = ({
  authenticatedUserId,
  cookieHeader,
  createdByDisplayName,
  createId,
  database,
  name,
  now,
  pageId,
  secret,
}: AccessOptions & {
  createId?: () => string
  createdByDisplayName: string | null
  name: string
  now?: string
}): CreatePageSnapshotMutationResult => {
  const access = resolveSnapshotAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    pageId,
    secret,
  })

  if (!access || access.readOnly) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  return createSnapshot(database, {
    createId,
    createdBy: {
      displayName: createdByDisplayName,
      userId: authenticatedUserId ?? null,
    },
    name,
    now,
    pageId,
  })
}

export const deletePageSnapshotMutation = ({
  authenticatedUserId,
  cookieHeader,
  database,
  pageId,
  secret,
  snapshotId,
}: AccessOptions & {
  snapshotId: string
}): DeletePageSnapshotMutationResult => {
  const access = resolveSnapshotAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    pageId,
    secret,
  })

  if (!access || access.readOnly) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  if (!canMutateOwnedSnapshot(database, pageId, authenticatedUserId)) {
    return {
      kind: 'forbidden',
      reason: 'owner-required',
    }
  }

  return deleteSnapshot(database, pageId, snapshotId)
    ? {
        kind: 'ok',
      }
    : {
        kind: 'not-found',
        reason: 'snapshot-not-found',
      }
}

export const restorePageSnapshotCopyMutation = ({
  authenticatedUserId,
  cookieHeader,
  createPageId,
  createToken,
  database,
  now,
  ownerUserId,
  pageId,
  requestUrl,
  secret,
  snapshotId,
}: AccessOptions & {
  createPageId?: () => string
  createToken?: () => string
  now?: string
  ownerUserId?: string | null
  requestUrl: string
  snapshotId: string
}): RestorePageSnapshotCopyMutationResult => {
  const access = resolveSnapshotAccess({
    authenticatedUserId,
    cookieHeader,
    database,
    pageId,
    secret,
  })

  if (!access || access.readOnly) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  if (!canMutateOwnedSnapshot(database, pageId, authenticatedUserId)) {
    return {
      kind: 'forbidden',
      reason: 'owner-required',
    }
  }

  return restoreSnapshotAsCopy(database, {
    createPageId,
    createToken,
    now,
    ownerUserId: ownerUserId ?? authenticatedUserId ?? null,
    pageId,
    requestUrl,
    snapshotId,
  })
}

const resolveSnapshotAccess = ({
  authenticatedUserId,
  cookieHeader,
  database,
  pageId,
  secret,
}: AccessOptions) => {
  const sessionAccess = getPageAccessFromSession(
    database,
    pageId,
    getPageSessionFromCookie(cookieHeader, secret)
  )

  if (sessionAccess) return sessionAccess

  return getPageAccessFromAuthenticatedUser(
    database,
    pageId,
    authenticatedUserId
  )
}

const canMutateOwnedSnapshot = (
  database: ToolDatabase,
  pageId: string,
  authenticatedUserId: string | null | undefined
) => {
  const page = getPageRecord(database, pageId)

  return !page?.ownerUserId || page.ownerUserId === authenticatedUserId
}
