import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaComment } from './areaComments.ts'
import type { AreaState } from './App.tsx'
import type { AgentPatch } from './agentInterface.ts'
import {
  buildNeedsAttentionQueue,
  buildTaskBoard,
} from './taskBoard.ts'

const now = '2026-07-06T12:00:00.000Z'

const createArea = (
  overrides: Partial<AreaState> & { id: string; text: string }
): AreaState => ({
  id: overrides.id,
  parentId: null,
  x: 0,
  y: 0,
  width: 240,
  height: 120,
  text: overrides.text,
  styles: {},
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

test('task board groups task Areas into mission-control columns', () => {
  const board = buildTaskBoard({
    areas: [
      createArea({
        id: 'task-open',
        text: 'Task: write tests',
        metadata: {
          kind: 'task',
          tags: [],
        },
      }),
      createArea({
        id: 'task-doing',
        text: 'Task: wire claim tool',
        metadata: {
          kind: 'task',
          status: 'in-progress',
          tags: [],
          assignee: {
            kind: 'agent',
            name: 'GLM Worker',
          },
        },
      }),
      createArea({
        id: 'note-1',
        text: 'Not a task',
        metadata: {
          kind: 'note',
          tags: [],
        },
      }),
    ],
  })

  assert.deepEqual(
    board.map((column) => [column.label, column.cards.map((card) => card.areaId)]),
    [
      ['Todo', ['task-open']],
      ['Doing', ['task-doing']],
      ['Done', []],
      ['Blocked', []],
    ]
  )
  assert.deepEqual(board[1].cards[0].assignee, {
    kind: 'agent',
    name: 'GLM Worker',
  })
})

test('needs-attention queue orders proposals, blocked tasks, then comments', () => {
  const areas = [
    createArea({
      id: 'task-blocked',
      text: 'Task: fix deploy',
      metadata: {
        kind: 'task',
        status: 'blocked',
        tags: [],
      },
    }),
    createArea({
      id: 'task-commented',
      text: 'Task: review mobile view',
      metadata: {
        kind: 'task',
        tags: [],
      },
    }),
  ]
  const comments: AreaComment[] = [
    {
      id: 'comment-1',
      areaId: 'task-commented',
      authorName: 'Riley',
      authorColor: '#2563eb',
      text: 'Needs another look.',
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      id: 'comment-2',
      areaId: 'task-commented',
      authorName: 'Riley',
      authorColor: '#2563eb',
      text: 'Resolved already.',
      createdAt: now,
      resolvedAt: now,
      resolvedBy: 'Riley',
    },
  ]
  const agentProposal: AgentPatch = {
    schemaVersion: 1,
    id: 'patch-1',
    pageId: 'page-1',
    source: {
      kind: 'agent',
      clientId: 'agent-1',
      displayName: 'GLM Worker',
    },
    operations: [
      {
        op: 'updateArea',
        areaId: 'task-commented',
        patch: {
          text: 'Updated task',
        },
      },
    ],
    createdAt: now,
  }

  assert.deepEqual(
    buildNeedsAttentionQueue({ agentProposal, areas, comments }).map(
      (item) => item.kind
    ),
    ['proposal', 'blocked-task', 'comment-thread']
  )
})
