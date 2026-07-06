// SQLite-backed store for the MCP Tasks extension (2026-07-28 revision).
//
// Task state lives in the shared database so any server instance can answer
// tasks/get and tasks/cancel — the gateway itself stays stateless per
// request. Records carry the minting token id so a revoked token's tasks
// can fail closed on the next poll.
import { randomUUID } from 'node:crypto'

import type { ToolDatabase } from './database.ts'

export type McpTaskStatus = 'working' | 'completed' | 'failed' | 'cancelled'

export type McpTaskRecord = {
  id: string
  pageId: string
  tokenId: string | null
  toolName: string
  status: McpTaskStatus
  createdAt: string
  updatedAt: string
  result: unknown
  error: string | null
}

type McpTaskRow = {
  id: string
  pageId: string
  tokenId: string | null
  toolName: string
  status: McpTaskStatus
  createdAt: string
  updatedAt: string
  resultJson: string | null
  error: string | null
}

const MAX_LISTED_TASKS = 20

export const createMcpTask = (
  database: ToolDatabase,
  {
    createId = () => `mcp_task_${randomUUID()}`,
    now = new Date().toISOString(),
    pageId,
    tokenId,
    toolName,
  }: {
    createId?: () => string
    now?: string
    pageId: string
    tokenId: string | null
    toolName: string
  }
): McpTaskRecord => {
  const record: McpTaskRecord = {
    id: createId(),
    pageId,
    tokenId,
    toolName,
    status: 'working',
    createdAt: now,
    updatedAt: now,
    result: null,
    error: null,
  }

  database
    .prepare(
      `insert into mcp_tasks
        (id, page_id, token_id, tool_name, status, created_at, updated_at,
         result_json, error)
       values (?, ?, ?, ?, 'working', ?, ?, null, null)`
    )
    .run(record.id, pageId, tokenId, toolName, now, now)

  return record
}

export const getMcpTask = (
  database: ToolDatabase,
  taskId: string
): McpTaskRecord | null => {
  const row = database
    .prepare(
      `${SELECT_TASK}
       where id = ?
       limit 1`
    )
    .get(taskId) as McpTaskRow | undefined

  return row ? rowToRecord(row) : null
}

export const listMcpTasks = (
  database: ToolDatabase,
  pageId: string
): McpTaskRecord[] =>
  (
    database
      .prepare(
        `${SELECT_TASK}
         where page_id = ?
         order by created_at desc
         limit ${MAX_LISTED_TASKS}`
      )
      .all(pageId) as McpTaskRow[]
  ).map(rowToRecord)

// Completion and failure only land on tasks that are still working, so a
// cancelled task can never be resurrected by a late provider response.
export const completeMcpTask = (
  database: ToolDatabase,
  taskId: string,
  result: unknown,
  now = new Date().toISOString()
) =>
  database
    .prepare(
      `update mcp_tasks
       set status = 'completed', result_json = ?, updated_at = ?
       where id = ? and status = 'working'`
    )
    .run(JSON.stringify(result ?? null), now, taskId).changes > 0

export const failMcpTask = (
  database: ToolDatabase,
  taskId: string,
  message: string,
  now = new Date().toISOString()
) =>
  database
    .prepare(
      `update mcp_tasks
       set status = 'failed', error = ?, updated_at = ?
       where id = ? and status in ('working', 'completed')`
    )
    .run(message, now, taskId).changes > 0

export const cancelMcpTask = (
  database: ToolDatabase,
  taskId: string,
  now = new Date().toISOString()
): McpTaskRecord | null => {
  database
    .prepare(
      `update mcp_tasks
       set status = 'cancelled', updated_at = ?
       where id = ? and status = 'working'`
    )
    .run(now, taskId)

  return getMcpTask(database, taskId)
}

const SELECT_TASK = `select id,
       page_id as pageId,
       token_id as tokenId,
       tool_name as toolName,
       status,
       created_at as createdAt,
       updated_at as updatedAt,
       result_json as resultJson,
       error
from mcp_tasks`

const rowToRecord = (row: McpTaskRow): McpTaskRecord => ({
  id: row.id,
  pageId: row.pageId,
  tokenId: row.tokenId,
  toolName: row.toolName,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  result: readJson(row.resultJson),
  error: row.error,
})

const readJson = (value: string | null): unknown => {
  if (value === null) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
