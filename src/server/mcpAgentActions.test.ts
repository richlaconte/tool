import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import {
  listMcpAgentActions,
  recordMcpAgentAction,
} from './mcpAgentActions.ts'

test('MCP agent action records persist in SQLite by page', () => {
  const database = createInMemoryDatabase()

  recordMcpAgentAction(database, {
    id: 'action-1',
    pageId: 'page-1',
    toolName: 'get_page',
    clientId: 'no-auth-mcp',
    clientDisplayName: 'No-auth MCP client',
    operationCount: 0,
    createdAt: '2026-06-29T12:00:00.000Z',
    result: 'success',
  })
  recordMcpAgentAction(database, {
    id: 'action-2',
    pageId: 'page-2',
    toolName: 'missing',
    clientId: 'no-auth-mcp',
    clientDisplayName: 'No-auth MCP client',
    operationCount: 0,
    createdAt: '2026-06-29T12:01:00.000Z',
    result: 'error',
    errorCode: -32004,
  })

  assert.deepEqual(listMcpAgentActions(database, 'page-1'), [
    {
      id: 'action-1',
      pageId: 'page-1',
      toolName: 'get_page',
      clientId: 'no-auth-mcp',
      clientDisplayName: 'No-auth MCP client',
      operationCount: 0,
      createdAt: '2026-06-29T12:00:00.000Z',
      result: 'success',
    },
  ])
})
