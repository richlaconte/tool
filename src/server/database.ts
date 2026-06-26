import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import Database from 'better-sqlite3'
import type { Database as DatabaseConnection } from 'better-sqlite3'

export type ToolDatabase = DatabaseConnection

export const createInMemoryDatabase = () => {
  const database = new Database(':memory:')
  setupDatabase(database)
  return database
}

export const createDatabase = (
  path = process.env.TOOL_DATABASE_PATH ?? './.data/tool.sqlite'
) => {
  mkdirSync(dirname(path), { recursive: true })

  const database = new Database(path)
  setupDatabase(database)
  return database
}

export const setupDatabase = (database: ToolDatabase) => {
  database.exec(`
    create table if not exists pages (
      id text primary key,
      title text not null,
      created_at text not null,
      updated_at text not null,
      deleted_at text
    );

    create table if not exists share_links (
      id text primary key,
      page_id text not null,
      mode text not null check (mode in ('edit', 'view')),
      token_hash text not null,
      created_at text not null,
      updated_at text not null,
      revoked_at text,
      foreign key (page_id) references pages(id)
    );

    create index if not exists share_links_lookup
      on share_links(page_id, mode, token_hash, revoked_at);

    create table if not exists assets (
      id text primary key,
      page_id text not null,
      kind text not null,
      mime_type text not null,
      width integer not null,
      height integer not null,
      storage_key text not null,
      created_at text not null,
      foreign key (page_id) references pages(id)
    );
  `)
}
