import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getLatestMcpAgentActivity,
  getMcpAgentActivityLabel,
} from './mcpAgentActivity.ts'

test('formats MCP proposal activity as a short status', () => {
  assert.equal(
    getMcpAgentActivityLabel({
      id: 'action-1',
      pageId: 'page-1',
      toolName: 'suggest_decision_log',
      clientId: 'codex',
      clientDisplayName: 'Codex',
      operationCount: 6,
      createdAt: '2026-06-26T12:00:00.000Z',
      result: 'success',
    }),
    'Codex proposed 6 changes'
  )
})

test('formats MCP read activity without implying changes', () => {
  assert.equal(
    getMcpAgentActivityLabel({
      id: 'action-2',
      pageId: 'page-1',
      toolName: 'get_page',
      clientId: 'codex',
      clientDisplayName: 'Codex',
      operationCount: 0,
      createdAt: '2026-06-26T12:01:00.000Z',
      result: 'success',
    }),
    'Codex read this page'
  )
})

test('formats MCP errors as human-readable app status', () => {
  assert.equal(
    getMcpAgentActivityLabel({
      id: 'action-3',
      pageId: 'page-1',
      toolName: 'search_areas',
      clientId: 'codex',
      clientDisplayName: 'Codex',
      operationCount: 0,
      createdAt: '2026-06-26T12:02:00.000Z',
      result: 'error',
      errorCode: -32004,
    }),
    'Codex could not complete search areas'
  )
})

test('selects the newest valid MCP activity record', () => {
  const latest = getLatestMcpAgentActivity([
    {
      id: 'old',
      pageId: 'page-1',
      toolName: 'get_page',
      clientId: 'codex',
      clientDisplayName: 'Codex',
      operationCount: 0,
      createdAt: '2026-06-26T12:00:00.000Z',
      result: 'success',
    },
    {
      id: 'new',
      pageId: 'page-1',
      toolName: 'suggest_decision_log',
      clientId: 'codex',
      clientDisplayName: 'Codex',
      operationCount: 1,
      createdAt: '2026-06-26T12:03:00.000Z',
      result: 'success',
    },
    {
      nope: true,
    },
  ])

  assert.equal(latest?.id, 'new')
})
