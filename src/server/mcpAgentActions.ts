import type { ToolDatabase } from './database.ts'

export const DEFAULT_MCP_AGENT_ACTION_LIMIT = 100

export type PersistedMcpAgentActionRecord = {
  id: string
  pageId: string | null
  toolName: string
  clientId: string
  clientDisplayName: string
  operationCount: number
  createdAt: string
  result: 'success' | 'error'
  errorCode?: number
}

export const recordMcpAgentAction = (
  database: ToolDatabase,
  record: PersistedMcpAgentActionRecord
) => {
  database
    .prepare(
      `insert or replace into mcp_agent_actions (
        id,
        page_id,
        tool_name,
        client_id,
        client_display_name,
        operation_count,
        created_at,
        result,
        error_code
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.pageId,
      record.toolName,
      record.clientId,
      record.clientDisplayName,
      record.operationCount,
      record.createdAt,
      record.result,
      record.errorCode ?? null
    )
}

export const listMcpAgentActions = (
  database: ToolDatabase,
  pageId: string,
  limit = DEFAULT_MCP_AGENT_ACTION_LIMIT
): PersistedMcpAgentActionRecord[] => {
  const rows = database
    .prepare(
      `select
        id,
        page_id as pageId,
        tool_name as toolName,
        client_id as clientId,
        client_display_name as clientDisplayName,
        operation_count as operationCount,
        created_at as createdAt,
        result,
        error_code as errorCode
      from mcp_agent_actions
      where page_id = ?
      order by created_at desc
      limit ?`
    )
    .all(pageId, limit) as StoredMcpAgentActionRow[]

  return rows.map((row) => ({
    id: row.id,
    pageId: row.pageId,
    toolName: row.toolName,
    clientId: row.clientId,
    clientDisplayName: row.clientDisplayName,
    operationCount: row.operationCount,
    createdAt: row.createdAt,
    result: row.result,
    ...(typeof row.errorCode === 'number'
      ? { errorCode: row.errorCode }
      : {}),
  }))
}

type StoredMcpAgentActionRow = {
  id: string
  pageId: string | null
  toolName: string
  clientId: string
  clientDisplayName: string
  operationCount: number
  createdAt: string
  result: 'success' | 'error'
  errorCode: number | null
}
