import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaState } from './App.tsx'
import type { AreaKind, AreaLink, AreaStatus } from './areaMetadata.ts'
import type { PageAppState } from './pagePersistence.ts'
import {
  areaAnchorComment,
  compileSddBundle,
  orderTasksByDependency,
} from './sddExport.ts'

const makeArea = (
  id: string,
  kind: AreaKind,
  text: string,
  overrides: {
    x?: number
    y?: number
    status?: AreaStatus
    evidence?: { kind: string; label: string; target: string }[]
  } = {}
): AreaState => ({
  id,
  type: 'text',
  parentId: null,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  width: 300,
  height: 140,
  text,
  styles: {},
  metadata: {
    kind,
    ...(overrides.status ? { status: overrides.status } : {}),
    tags: [],
    ...(overrides.evidence
      ? {
          evidence: overrides.evidence.map((entry, index) => ({
            id: `ev_${id}_${index}`,
            kind: entry.kind as never,
            label: entry.label,
            target: entry.target,
            createdAt: '2026-07-01T00:00:00.000Z',
          })),
        }
      : {}),
  },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
})

const makeState = (
  areas: AreaState[],
  links: AreaLink[] = []
): PageAppState => ({
  page: {
    id: 'page_1',
    title: 'Checkout redesign',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    settings: {
      background: '#ffffff',
      mcp: { enabled: false },
      snapGrid: { enabled: false, size: 20, visible: false },
      theme: { colors: [] },
      shareLinks: null,
    },
  },
  areas,
  assets: [],
  links,
  comments: [],
})

const makeLink = (
  id: string,
  fromAreaId: string,
  toAreaId: string,
  kind: AreaLink['kind']
): AreaLink => ({
  id,
  fromAreaId,
  toAreaId,
  kind,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
})

test('spec.md groups areas by kind under the right headings', () => {
  const state = makeState([
    makeArea('n1', 'note', 'Context\n\nBackground detail.', { y: 0 }),
    makeArea('d1', 'decision', 'Use Stripe', { y: 100, status: 'decided' }),
    makeArea('q1', 'question', 'Do we support Apple Pay?', { y: 200 }),
    makeArea('r1', 'risk', 'PCI scope creep', { y: 300 }),
    makeArea('a1', 'api', 'POST /checkout', { y: 400 }),
  ])

  const { spec } = compileSddBundle(state)

  assert.match(spec, /^# Checkout redesign/)
  assert.match(spec, /## Context/)
  assert.match(spec, /## Decisions/)
  assert.match(spec, /### Use Stripe \(decided\)/)
  assert.match(spec, /## Open Questions/)
  assert.match(spec, /### Do we support Apple Pay\?/)
  assert.match(spec, /## Risks/)
  assert.match(spec, /## Contracts and States/)
  assert.match(spec, /### POST \/checkout/)
})

test('every compiled item carries a stable anchor comment', () => {
  const state = makeState([
    makeArea('d1', 'decision', 'Use Stripe', { status: 'decided' }),
  ])

  const { spec } = compileSddBundle(state)

  assert.match(spec, new RegExp(areaAnchorComment('d1')))
})

test('tasks render as a checklist reflecting status', () => {
  const state = makeState([
    makeArea('t1', 'task', 'Wire the payment form', { y: 0, status: 'done' }),
    makeArea('t2', 'task', 'Add validation', { y: 100, status: 'in-progress' }),
    makeArea('t3', 'task', 'Ship it', { y: 200, status: 'blocked' }),
    makeArea('t4', 'task', 'Untouched task', { y: 300 }),
  ])

  const { tasks } = compileSddBundle(state)

  assert.match(tasks, /- \[x\] Wire the payment form/)
  assert.match(tasks, /- \[ \] Add validation \(in-progress\)/)
  assert.match(tasks, /- \[ \] Ship it \(blocked\)/)
  assert.match(tasks, /- \[ \] Untouched task/)
})

test('plan.md renders architecture with evidence and dependencies', () => {
  const state = makeState(
    [
      makeArea('c1', 'component', 'Checkout form', {
        y: 0,
        evidence: [
          { kind: 'file', label: 'CheckoutForm.tsx', target: 'src/CheckoutForm.tsx:12' },
        ],
      }),
      makeArea('f1', 'file', 'Payment client', { y: 100 }),
    ],
    [makeLink('l1', 'c1', 'f1', 'depends-on')]
  )

  const { plan } = compileSddBundle(state)

  assert.match(plan, /## Architecture/)
  assert.match(plan, /### Checkout form/)
  assert.match(plan, /Evidence \(file\): CheckoutForm\.tsx — `src\/CheckoutForm\.tsx:12`/)
  assert.match(plan, /Depends on: Payment client/)
})

test('compiling twice yields byte-identical output', () => {
  const state = makeState(
    [
      makeArea('d1', 'decision', 'Use Stripe', { y: 0, status: 'decided' }),
      makeArea('t1', 'task', 'Wire it up', { y: 100 }),
      makeArea('t2', 'task', 'Test it', { y: 200 }),
    ],
    [makeLink('l1', 't2', 't1', 'depends-on')]
  )

  const first = compileSddBundle(state)
  const second = compileSddBundle(state)

  assert.equal(first.spec, second.spec)
  assert.equal(first.plan, second.plan)
  assert.equal(first.tasks, second.tasks)
  assert.equal(first.combined, second.combined)
})

test('combined bundle concatenates the three files with separators', () => {
  const state = makeState([makeArea('d1', 'decision', 'Use Stripe')])
  const { combined } = compileSddBundle(state)

  assert.match(combined, /# spec\.md/)
  assert.match(combined, /# plan\.md/)
  assert.match(combined, /# tasks\.md/)
})

test('dependency ordering places prerequisites first', () => {
  const t1 = makeArea('t1', 'task', 'Deploy', { y: 0 })
  const t2 = makeArea('t2', 'task', 'Build', { y: 100 })
  const t3 = makeArea('t3', 'task', 'Test', { y: 200 })

  // Deploy depends-on Build; Test depends-on Build.
  const { ordered, hasCycle } = orderTasksByDependency(
    [t1, t2, t3],
    [makeLink('l1', 't1', 't2', 'depends-on'), makeLink('l2', 't3', 't2', 'depends-on')]
  )

  assert.equal(hasCycle, false)
  assert.equal(ordered[0].id, 't2')
  assert.deepEqual(
    ordered.map((area) => area.id),
    ['t2', 't1', 't3']
  )
})

test('a dependency cycle falls back to reading order with a warning', () => {
  const t1 = makeArea('t1', 'task', 'A', { y: 0 })
  const t2 = makeArea('t2', 'task', 'B', { y: 100 })

  const { ordered, hasCycle } = orderTasksByDependency(
    [t1, t2],
    [
      makeLink('l1', 't1', 't2', 'depends-on'),
      makeLink('l2', 't2', 't1', 'depends-on'),
    ]
  )

  assert.equal(hasCycle, true)
  assert.deepEqual(
    ordered.map((area) => area.id),
    ['t1', 't2']
  )

  const state = makeState(
    [t1, t2],
    [
      makeLink('l1', 't1', 't2', 'depends-on'),
      makeLink('l2', 't2', 't1', 'depends-on'),
    ]
  )

  assert.match(compileSddBundle(state).tasks, /Dependency cycle detected/)
})

test('empty page still compiles to titled documents', () => {
  const { spec, plan, tasks } = compileSddBundle(makeState([]))

  assert.match(spec, /^# Checkout redesign/)
  assert.match(plan, /— Plan/)
  assert.match(tasks, /— Tasks/)
})
