import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createDatabase, createInMemoryDatabase } from './database.ts'
import {
  cancelMcpTask,
  completeMcpTask,
  createMcpTask,
  failMcpTask,
  getMcpTask,
  listMcpTasks,
} from './mcpTasks.ts'
import { isMcpTokenActive, mintMcpToken, revokeMcpToken } from './mcpTokens.ts'

const now = '2026-07-06T12:00:00.000Z'
const later = '2026-07-06T12:00:05.000Z'

const insertPage = (
  database: ReturnType<typeof createInMemoryDatabase>,
  pageId: string
) => {
  database
    .prepare(
      `insert into pages (id, title, created_at, updated_at)
       values (?, 'Test page', ?, ?)`
    )
    .run(pageId, now, now)
}

test('MCP tasks move through the create, complete, and list lifecycle', () => {
  const database = createInMemoryDatabase()
  insertPage(database, 'page-1')

  const task = createMcpTask(database, {
    createId: () => 'task-1',
    now,
    pageId: 'page-1',
    tokenId: 'token-1',
    toolName: 'ai_suggest_decision_log',
  })

  assert.equal(task.id, 'task-1')
  assert.equal(task.status, 'working')
  assert.equal(getMcpTask(database, 'task-1')?.status, 'working')

  const completed = completeMcpTask(
    database,
    'task-1',
    { schemaVersion: 1, id: 'patch-1', operations: [] },
    later
  )
  const record = getMcpTask(database, 'task-1')

  assert.equal(completed, true)
  assert.equal(record?.status, 'completed')
  assert.equal(record?.updatedAt, later)
  assert.deepEqual(record?.result, {
    schemaVersion: 1,
    id: 'patch-1',
    operations: [],
  })
  assert.deepEqual(
    listMcpTasks(database, 'page-1').map((candidate) => candidate.id),
    ['task-1']
  )
  assert.deepEqual(listMcpTasks(database, 'page-2'), [])
})

test('MCP task cancellation wins over a late provider completion', () => {
  const database = createInMemoryDatabase()
  insertPage(database, 'page-1')
  createMcpTask(database, {
    createId: () => 'task-cancel',
    now,
    pageId: 'page-1',
    tokenId: null,
    toolName: 'ai_suggest_decision_log',
  })

  const cancelled = cancelMcpTask(database, 'task-cancel', later)
  const lateCompletion = completeMcpTask(database, 'task-cancel', {
    id: 'patch-late',
  })
  const record = getMcpTask(database, 'task-cancel')

  assert.equal(cancelled?.status, 'cancelled')
  assert.equal(lateCompletion, false)
  assert.equal(record?.status, 'cancelled')
  assert.equal(record?.result, null)
})

test('MCP task failure records the error and can fail a completed task closed', () => {
  const database = createInMemoryDatabase()
  insertPage(database, 'page-1')
  createMcpTask(database, {
    createId: () => 'task-fail',
    now,
    pageId: 'page-1',
    tokenId: 'token-1',
    toolName: 'ai_suggest_decision_log',
  })
  completeMcpTask(database, 'task-fail', { id: 'patch-1' })

  const failed = failMcpTask(
    database,
    'task-fail',
    'MCP token is no longer active.',
    later
  )
  const record = getMcpTask(database, 'task-fail')

  assert.equal(failed, true)
  assert.equal(record?.status, 'failed')
  assert.equal(record?.error, 'MCP token is no longer active.')
})

test('MCP tasks persist across a simulated server restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cascadery-mcp-tasks-'))
  const databasePath = join(directory, 'tasks.sqlite')

  try {
    const firstConnection = createDatabase(databasePath)
    insertPage(firstConnection, 'page-1')
    createMcpTask(firstConnection, {
      createId: () => 'task-restart',
      now,
      pageId: 'page-1',
      tokenId: null,
      toolName: 'ai_suggest_decision_log',
    })
    completeMcpTask(firstConnection, 'task-restart', { id: 'patch-restart' })
    firstConnection.close()

    const secondConnection = createDatabase(databasePath)
    const record = getMcpTask(secondConnection, 'task-restart')

    assert.equal(record?.status, 'completed')
    assert.deepEqual(record?.result, { id: 'patch-restart' })
    secondConnection.close()
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('isMcpTokenActive reports revoked and expired tokens as inactive', () => {
  const database = createInMemoryDatabase()
  insertPage(database, 'page-1')

  const minted = mintMcpToken(database, {
    now,
    pageId: 'page-1',
    scopes: ['page:read', 'page:suggest'],
  })
  const expiring = mintMcpToken(database, {
    expiresAt: later,
    now,
    pageId: 'page-1',
    scopes: ['page:read'],
  })

  assert.equal(isMcpTokenActive(database, minted.record.id, now), true)
  assert.equal(isMcpTokenActive(database, 'missing-token', now), false)
  assert.equal(
    isMcpTokenActive(database, expiring.record.id, '2026-07-07T00:00:00.000Z'),
    false
  )

  revokeMcpToken(database, minted.record.id, {
    now: later,
    pageId: 'page-1',
  })

  assert.equal(isMcpTokenActive(database, minted.record.id, later), false)
})
