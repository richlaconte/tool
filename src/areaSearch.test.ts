import assert from 'node:assert/strict'
import test from 'node:test'

import { searchAreas } from './areaSearch.ts'
import type { AreaState } from './App.tsx'

const areas: AreaState[] = [
  {
    id: 'task-1',
    parentId: null,
    x: 400,
    y: 100,
    width: 240,
    height: 100,
    text: 'Ship deployment\nWire Fly deploy and health checks.',
    metadata: {
      kind: 'task',
      status: 'open',
      tags: ['release'],
      evidence: [
        {
          id: 'evidence-1',
          kind: 'file',
          label: 'server.ts',
          target: 'src/server.ts',
          createdAt: '2026-07-02T12:00:00.000Z',
        },
      ],
    },
    styles: {},
  },
  {
    id: 'risk-1',
    parentId: null,
    x: 100,
    y: 220,
    width: 240,
    height: 100,
    text: 'Deployment risk\nFly volume failover needs review.',
    metadata: {
      kind: 'risk',
      status: 'blocked',
      tags: ['release', 'infra'],
    },
    styles: {},
  },
  {
    id: 'decision-1',
    parentId: null,
    x: 40,
    y: 100,
    width: 240,
    height: 100,
    text: 'Use SQLite\nDeployment state stays portable.',
    metadata: {
      kind: 'decision',
      status: 'decided',
      tags: [],
    },
    styles: {},
  },
]

test('searches Area text, metadata, tags, and evidence', () => {
  assert.deepEqual(
    searchAreas(areas, 'deployment').map((result) => ({
      areaId: result.areaId,
      matchField: result.matchField,
      excerpt: result.excerpt,
    })),
    [
      {
        areaId: 'task-1',
        matchField: 'text',
        excerpt: 'Ship deployment',
      },
      {
        areaId: 'risk-1',
        matchField: 'text',
        excerpt: 'Deployment risk',
      },
      {
        areaId: 'decision-1',
        matchField: 'text',
        excerpt: 'Deployment state stays portable.',
      },
    ]
  )

  assert.deepEqual(
    searchAreas(areas, 'infra').map((result) => result.matchField),
    ['tag']
  )
  assert.deepEqual(
    searchAreas(areas, 'server.ts').map((result) => result.matchField),
    ['evidence']
  )
})

test('supports kind and status filters', () => {
  assert.deepEqual(
    searchAreas(areas, 'kind:task').map((result) => result.areaId),
    ['task-1']
  )
  assert.deepEqual(
    searchAreas(areas, 'status:blocked').map((result) => result.areaId),
    ['risk-1']
  )
  assert.deepEqual(searchAreas(areas, 'kind:missing'), [])
})

test('returns no results for blank queries', () => {
  assert.deepEqual(searchAreas(areas, '   '), [])
})
