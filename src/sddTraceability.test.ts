import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaState } from './App'
import { createAreaLink } from './areaMetadata.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'
import { getSddTraceability, hasSddTraceabilityContent } from './sddTraceability.ts'

const now = '2026-07-06T12:00:00.000Z'

const textArea = (
  id: string,
  kind: 'requirement' | 'task' | 'note',
  y: number,
  overrides: Partial<AreaState> = {}
): AreaState =>
  ({
    id,
    parentId: null,
    x: 100,
    y,
    width: 260,
    height: 120,
    text: `${kind}: ${id}`,
    styles: {},
    metadata: { kind, tags: [] },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as AreaState

const makeState = (
  areas: AreaState[],
  links: PageAppState['links'] = []
): PageAppState => ({
  page: createDefaultPageState({ id: 'page-1', now }),
  areas,
  assets: [],
  links,
})

test('traceability maps implements links in both endpoint directions', () => {
  const state = makeState(
    [
      textArea('req-1', 'requirement', 100),
      textArea('req-2', 'requirement', 200),
      textArea('task-1', 'task', 300),
      textArea('task-2', 'task', 400),
      textArea('note-1', 'note', 500),
    ],
    [
      // Canonical: task → requirement.
      createAreaLink({
        id: 'link-1',
        fromAreaId: 'task-1',
        toAreaId: 'req-1',
        kind: 'implements',
        now,
      }),
      // Reverse endpoints, same meaning.
      createAreaLink({
        id: 'link-2',
        fromAreaId: 'req-2',
        toAreaId: 'task-2',
        kind: 'implements',
        now,
      }),
      // Wrong kind: ignored.
      createAreaLink({
        id: 'link-3',
        fromAreaId: 'task-2',
        toAreaId: 'req-1',
        kind: 'relates-to',
        now,
      }),
      // Wrong kinds of endpoints: ignored.
      createAreaLink({
        id: 'link-4',
        fromAreaId: 'note-1',
        toAreaId: 'req-1',
        kind: 'implements',
        now,
      }),
    ]
  )

  const traceability = getSddTraceability(state)

  assert.equal(hasSddTraceabilityContent(traceability), true)
  assert.deepEqual(traceability.implementedBy.get('req-1'), ['task-1'])
  assert.deepEqual(traceability.implementedBy.get('req-2'), ['task-2'])
  assert.deepEqual(traceability.implementsRefs.get('task-1'), ['req-1'])
  assert.deepEqual(traceability.implementsRefs.get('task-2'), ['req-2'])
  assert.deepEqual(traceability.uncoveredRequirements, [])
  assert.deepEqual(traceability.unlinkedTasks, [])
})

test('traceability reports uncovered requirements and unlinked tasks in reading order', () => {
  const state = makeState(
    [
      textArea('req-covered', 'requirement', 100),
      textArea('req-uncovered-b', 'requirement', 300),
      textArea('req-uncovered-a', 'requirement', 200),
      textArea('task-linked', 'task', 400),
      textArea('task-loose', 'task', 500),
    ],
    [
      createAreaLink({
        id: 'link-1',
        fromAreaId: 'task-linked',
        toAreaId: 'req-covered',
        kind: 'implements',
        now,
      }),
    ]
  )

  const traceability = getSddTraceability(state)

  assert.deepEqual(
    traceability.uncoveredRequirements.map((area) => area.id),
    ['req-uncovered-a', 'req-uncovered-b']
  )
  assert.deepEqual(
    traceability.unlinkedTasks.map((area) => area.id),
    ['task-loose']
  )
})

test('traceability uses absolute positions for nested Areas and ignores duplicates', () => {
  const parent = textArea('parent-note', 'note', 100, {
    x: 100,
  })
  const nestedRequirement = textArea('req-nested', 'requirement', 20, {
    parentId: 'parent-note',
    x: 10,
  })
  const state = makeState(
    [parent, nestedRequirement, textArea('task-1', 'task', 400)],
    [
      createAreaLink({
        id: 'link-1',
        fromAreaId: 'task-1',
        toAreaId: 'req-nested',
        kind: 'implements',
        now,
      }),
      // Duplicate edge must not double-count.
      createAreaLink({
        id: 'link-2',
        fromAreaId: 'task-1',
        toAreaId: 'req-nested',
        kind: 'implements',
        now,
      }),
    ]
  )

  const traceability = getSddTraceability(state)

  assert.deepEqual(traceability.implementedBy.get('req-nested'), [
    'task-1',
  ])
  assert.deepEqual(traceability.implementsRefs.get('task-1'), [
    'req-nested',
  ])
})

test('a page without requirements has no traceability content', () => {
  const state = makeState([textArea('task-1', 'task', 100)])
  const traceability = getSddTraceability(state)

  assert.equal(hasSddTraceabilityContent(traceability), false)
  assert.deepEqual(traceability.uncoveredRequirements, [])
  // Unlinked tasks are only meaningful once requirements exist.
  assert.deepEqual(
    traceability.unlinkedTasks.map((area) => area.id),
    ['task-1']
  )
})
