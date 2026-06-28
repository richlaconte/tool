export type McpAgentActivityRecord = {
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

const MCP_READ_TOOL_LABELS: Record<string, string> = {
  extract_decisions: 'extracted decisions',
  extract_open_questions: 'extracted open questions',
  get_area: 'read an Area',
  get_page: 'read this page',
  list_pages: 'listed pages',
  search_areas: 'searched Areas',
  summarize_page: 'summarized this page',
}

export const getMcpAgentActivityLabel = (
  record: McpAgentActivityRecord
) => {
  const clientName = record.clientDisplayName.trim() || 'MCP client'

  if (record.result === 'error') {
    return `${clientName} could not complete ${formatToolName(
      record.toolName
    )}`
  }

  if (record.operationCount > 0) {
    return `${clientName} proposed ${record.operationCount} change${
      record.operationCount === 1 ? '' : 's'
    }`
  }

  return `${clientName} ${
    MCP_READ_TOOL_LABELS[record.toolName] ??
    `used ${formatToolName(record.toolName)}`
  }`
}

export const getLatestMcpAgentActivity = (
  records: unknown
): McpAgentActivityRecord | null => {
  if (!Array.isArray(records)) return null

  const validRecords = records.filter(isMcpAgentActivityRecord)

  if (validRecords.length === 0) return null

  return validRecords.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )[0]
}

const formatToolName = (toolName: string) =>
  toolName.trim().replace(/_/g, ' ') || 'MCP tool'

const isMcpAgentActivityRecord = (
  value: unknown
): value is McpAgentActivityRecord => {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    (typeof value.pageId === 'string' || value.pageId === null) &&
    typeof value.toolName === 'string' &&
    typeof value.clientId === 'string' &&
    typeof value.clientDisplayName === 'string' &&
    typeof value.operationCount === 'number' &&
    Number.isFinite(value.operationCount) &&
    typeof value.createdAt === 'string' &&
    (value.result === 'success' || value.result === 'error') &&
    (value.errorCode === undefined || typeof value.errorCode === 'number')
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
