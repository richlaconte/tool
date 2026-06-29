import { createHash, randomBytes, randomUUID } from 'node:crypto'

import type { ToolDatabase } from './database.ts'

export type ShareMode = 'edit' | 'view'

export type PageRecord = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreatePageWithShareLinksOptions = {
  createToken?: () => string
  now?: string
  pageId?: string
  title?: string
}

export type CreatedPageWithShareLinks = {
  page: PageRecord
  editToken: string
  viewToken: string
}

export type ShareAccess = {
  pageId: string
  accessMode: ShareMode
  shareLinkUpdatedAt: string
}

export type RegenerateShareTokenOptions = {
  createToken?: () => string
  now?: string
}

export const createPageWithShareLinks = (
  database: ToolDatabase,
  {
    createToken = createShareToken,
    now = new Date().toISOString(),
    pageId = createId('page'),
    title = 'Untitled page',
  }: CreatePageWithShareLinksOptions = {}
): CreatedPageWithShareLinks => {
  const editToken = createToken()
  const viewToken = createToken()
  const page: PageRecord = {
    id: pageId,
    title,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  const createPage = database.transaction(() => {
    database
      .prepare(
        `insert into pages (id, title, created_at, updated_at, deleted_at)
         values (?, ?, ?, ?, null)`
      )
      .run(page.id, page.title, page.createdAt, page.updatedAt)

    insertShareLink(database, page.id, 'edit', editToken, now)
    insertShareLink(database, page.id, 'view', viewToken, now)
  })

  createPage()

  return {
    page,
    editToken,
    viewToken,
  }
}

export const validateShareToken = (
  database: ToolDatabase,
  pageId: string,
  accessMode: ShareMode,
  token: string
): ShareAccess | null => {
  const row = database
    .prepare(
      `select updated_at as shareLinkUpdatedAt
       from share_links
       where page_id = ?
         and mode = ?
         and token_hash = ?
         and revoked_at is null
       limit 1`
    )
    .get(pageId, accessMode, hashShareToken(token)) as
    | { shareLinkUpdatedAt: string }
    | undefined

  return row
    ? {
        pageId,
        accessMode,
        shareLinkUpdatedAt: row.shareLinkUpdatedAt,
      }
    : null
}

export const getActiveShareLinkUpdatedAt = (
  database: ToolDatabase,
  pageId: string,
  accessMode: ShareMode
) => {
  const row = database
    .prepare(
      `select updated_at as shareLinkUpdatedAt
       from share_links
       where page_id = ?
         and mode = ?
         and revoked_at is null
       order by updated_at desc
       limit 1`
    )
    .get(pageId, accessMode) as
    | { shareLinkUpdatedAt: string }
    | undefined

  return row?.shareLinkUpdatedAt ?? null
}

export const listPages = (database: ToolDatabase): PageRecord[] =>
  database
    .prepare(
      `select id, title, created_at as createdAt, updated_at as updatedAt,
              deleted_at as deletedAt
       from pages
       where deleted_at is null
       order by updated_at desc`
    )
    .all() as PageRecord[]

export const getPageRecord = (
  database: ToolDatabase,
  pageId: string
): PageRecord | null =>
  (database
    .prepare(
      `select id, title, created_at as createdAt, updated_at as updatedAt,
              deleted_at as deletedAt
       from pages
       where id = ?
         and deleted_at is null
       limit 1`
    )
    .get(pageId) as PageRecord | undefined) ?? null

export const regenerateShareToken = (
  database: ToolDatabase,
  pageId: string,
  accessMode: ShareMode,
  {
    createToken = createShareToken,
    now = new Date().toISOString(),
  }: RegenerateShareTokenOptions = {}
) => {
  const token = createToken()

  const regenerate = database.transaction(() => {
    database
      .prepare(
        `update share_links
         set revoked_at = ?, updated_at = ?
         where page_id = ?
           and mode = ?
           and revoked_at is null`
      )
      .run(now, now, pageId, accessMode)

    insertShareLink(database, pageId, accessMode, token, now)
  })

  regenerate()

  return {
    pageId,
    accessMode,
    token,
    shareLinkUpdatedAt: now,
  }
}

export const hashShareToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const insertShareLink = (
  database: ToolDatabase,
  pageId: string,
  mode: ShareMode,
  token: string,
  now: string
) => {
  database
    .prepare(
      `insert into share_links
        (id, page_id, mode, token_hash, created_at, updated_at, revoked_at)
       values (?, ?, ?, ?, ?, ?, null)`
    )
    .run(
      createId('share'),
      pageId,
      mode,
      hashShareToken(token),
      now,
      now
    )
}

const createShareToken = () => randomBytes(32).toString('base64url')

const createId = (prefix: string) => `${prefix}_${randomUUID()}`
