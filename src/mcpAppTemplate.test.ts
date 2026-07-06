import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getMcpAppPendingProposals,
  MCP_APP_PROPOSAL_MESSAGE_TYPE,
  renderMcpAppHtml,
  type McpAppTask,
} from './mcpAppTemplate.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'

const now = '2026-07-06T12:00:00.000Z'

const state: PageAppState = {
  page: {
    ...createDefaultPageState({ id: 'page-1', now }),
    title: 'Launch plan <q3>',
  },
  assets: [],
  areas: [
    {
      id: 'area-parent',
      parentId: null,
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      text: 'Rollout & risks',
      metadata: {
        kind: 'task',
        status: 'doing',
        tags: [],
        evidence: [],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'area-child',
      parentId: 'area-parent',
      x: 10,
      y: 10,
      width: 200,
      height: 100,
      text: 'Decision: ship behind a flag',
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
  journal: [
    {
      id: 'journal-1',
      actor: { kind: 'agent', name: 'GLM' },
      createdAt: now,
      taskAreaId: null,
      text: 'Drafted the rollout summary.',
    },
  ],
}

const completedTask: McpAppTask = {
  id: 'task-1',
  toolName: 'ai_suggest_decision_log',
  status: 'completed',
  createdAt: now,
  result: {
    schemaVersion: 1,
    id: 'patch-1',
    pageId: 'page-1',
    source: { kind: 'mcp-agent', clientId: 'glm', displayName: 'GLM' },
    operations: [{ op: 'createArea' }, { op: 'updateArea' }],
    createdAt: now,
  },
}

test('pending proposals come from completed tasks whose results are patches', () => {
  const proposals = getMcpAppPendingProposals([
    completedTask,
    {
      id: 'task-working',
      toolName: 'ai_suggest_decision_log',
      status: 'working',
      createdAt: now,
    },
    {
      id: 'task-no-patch',
      toolName: 'ai_suggest_decision_log',
      status: 'completed',
      createdAt: now,
      result: { note: 'not a patch' },
    },
  ])

  assert.deepEqual(proposals, [
    {
      taskId: 'task-1',
      patchId: 'patch-1',
      displayName: 'GLM',
      operationCount: 2,
      createdAt: now,
    },
  ])
})

test('the MCP App view renders the outline, proposals, and journal self-contained', () => {
  const html = renderMcpAppHtml(state, {
    tasks: [
      completedTask,
      {
        id: 'task-working',
        toolName: 'ai_suggest_decision_log',
        status: 'working',
        createdAt: now,
      },
    ],
  })

  assert.match(html, /Launch plan &lt;q3&gt;/)
  assert.match(html, /Rollout &amp; risks/)
  assert.match(html, /Decision: ship behind a flag/)
  assert.match(html, /GLM proposed 2 operations/)
  assert.match(html, /data-action="accept"/)
  assert.match(html, /data-action="reject"/)
  assert.match(html, /data-task-id="task-1"/)
  assert.match(html, /data-patch-id="patch-1"/)
  assert.match(html, new RegExp(MCP_APP_PROPOSAL_MESSAGE_TYPE))
  assert.match(html, /ai_suggest_decision_log is still working/)
  assert.match(html, /Drafted the rollout summary\./)
  assert.match(html, /Content-Security-Policy/)
  assert.doesNotMatch(html, /https?:\/\//)
  assert.doesNotMatch(html, /<script src/)
  assert.doesNotMatch(html, /<link/)
  assert.doesNotMatch(html, /<q3>/)
})

test('the MCP App view stays readable when the page is empty', () => {
  const emptyState: PageAppState = {
    page: createDefaultPageState({ id: 'page-empty', now }),
    areas: [],
    assets: [],
  }
  const html = renderMcpAppHtml(emptyState)

  assert.match(html, /No Areas yet\./)
  assert.match(html, /No pending proposals\./)
  assert.match(html, /No journal entries yet\./)
})
