import assert from 'node:assert/strict'
import test from 'node:test'

import { diffPageStates } from './pageDiff.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'

const now = '2026-07-05T12:00:00.000Z'

const createState = (overrides: Partial<PageAppState> = {}): PageAppState => ({
  page: {
    ...createDefaultPageState({ id: 'page_diff', now }),
    ...overrides.page,
  },
  assets: overrides.assets ?? [],
  areas: overrides.areas ?? [
    {
      id: 'area-a',
      parentId: null,
      x: 200,
      y: 100,
      width: 240,
      height: 120,
      text: 'Original decision\nwith detail',
      styles: {
        border: '1px solid #2563eb',
      },
      metadata: {
        kind: 'decision',
        status: 'open',
        tags: ['review'],
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'area-b',
      parentId: null,
      x: 40,
      y: 300,
      width: 180,
      height: 90,
      text: 'Task',
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
  links: overrides.links ?? [
    {
      id: 'link-a',
      fromAreaId: 'area-a',
      toAreaId: 'area-b',
      kind: 'depends-on',
      label: 'drives',
      visual: {
        mode: 'simple',
        direction: 'forward',
        route: 'auto',
        labelVisibility: 'auto',
      },
      createdAt: now,
      updatedAt: now,
    },
  ],
  comments: overrides.comments,
  journal: overrides.journal,
})

test('diffPageStates returns an empty diff for identical states', () => {
  const state = createState()

  assert.deepEqual(diffPageStates(state, state), {
    addedAreas: [],
    removedAreas: [],
    changedAreas: [],
    addedLinks: [],
    removedLinks: [],
    changedLinks: [],
    pageChanges: [],
  })
})

test('diffPageStates lists area changes by field with deterministic ordering and excerpts', () => {
  const before = createState()
  const after = createState({
    page: {
      ...before.page,
      title: 'Reviewed canvas',
    },
    areas: [
      {
        id: 'area-c',
        parentId: null,
        x: 20,
        y: 20,
        width: 120,
        height: 80,
        text: 'Added note',
        styles: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        ...before.areas[0],
        x: 260,
        width: 300,
        text: 'Updated decision with a very long first line that should be clipped before it overwhelms the list view',
        parentId: 'area-c',
        styles: {
          border: '2px solid #ef4444',
        },
        metadata: {
          kind: 'decision',
          status: 'decided',
          tags: ['review', 'approved'],
        },
      },
    ],
    links: [],
  })

  const diff = diffPageStates(before, after)

  assert.deepEqual(
    diff.addedAreas.map((area) => area.id),
    ['area-c']
  )
  assert.deepEqual(
    diff.removedAreas.map((area) => area.id),
    ['area-b']
  )
  assert.deepEqual(diff.changedAreas, [
    {
      id: 'area-a',
      changedFields: [
        'text',
        'position',
        'size',
        'styles',
        'metadata',
        'parent',
      ],
      before: {
        excerpt: 'Original decision',
      },
      after: {
        excerpt:
          'Updated decision with a very long first line that should be clipped before it...',
      },
    },
  ])
  assert.deepEqual(diff.removedLinks.map((link) => link.id), ['link-a'])
  assert.deepEqual(diff.pageChanges, ['title'])
})

test('diffPageStates reports changed links separately from added and removed links', () => {
  const before = createState()
  const after = createState({
    links: [
      {
        ...before.links![0],
        kind: 'references',
        label: 'documents',
      },
      {
        id: 'link-b',
        fromAreaId: 'area-b',
        toAreaId: 'area-a',
        kind: 'blocks',
        createdAt: now,
        updatedAt: now,
      },
    ],
  })

  const diff = diffPageStates(before, after)

  assert.deepEqual(diff.changedLinks.map((link) => link.id), ['link-a'])
  assert.deepEqual(diff.addedLinks.map((link) => link.id), ['link-b'])
  assert.deepEqual(diff.removedLinks, [])
})
