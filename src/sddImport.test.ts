import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaState } from './App.tsx'
import type { AgentClient } from './agentInterface.ts'
import { applyAgentPatch, MAX_IMPORT_OPERATIONS } from './agentInterface.ts'
import { getAreaMetadata, type AreaKind } from './areaMetadata.ts'
import type { PageAppState } from './pagePersistence.ts'
import { compileSddBundle, compileSpecKitBundle } from './sddExport.ts'
import {
  buildSddImportPatch,
  layoutSddImport,
  parseSddMarkdown,
} from './sddImport.ts'

const CLIENT: AgentClient = {
  id: 'test',
  displayName: 'Test',
  scopes: ['page:read', 'page:search', 'page:suggest', 'page:write'],
}

const makeArea = (
  id: string,
  kind: AreaKind,
  text: string,
  y = 0
): AreaState => ({
  id,
  type: 'text',
  parentId: null,
  x: 0,
  y,
  width: 300,
  height: 140,
  text,
  styles: {},
  metadata: { kind, tags: [] },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
})

const makeState = (areas: AreaState[] = []): PageAppState => ({
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
  links: [],
  comments: [],
})

test('parses sections into typed items', () => {
  const result = parseSddMarkdown(
    [
      '# Feature',
      '',
      '## Decisions',
      '',
      '### Use Stripe (decided)',
      '',
      'We already have an account.',
      '',
      '## Tasks',
      '',
      '- [x] Wire the form',
      '- [ ] Add validation (in-progress)',
    ].join('\n')
  )

  assert.equal(result.title, 'Feature')
  assert.equal(result.sections.length, 2)

  const decisions = result.sections[0]
  assert.equal(decisions.kind, 'decision')
  assert.equal(decisions.items[0].title, 'Use Stripe')
  assert.equal(decisions.items[0].status, 'decided')
  assert.equal(decisions.items[0].body, 'We already have an account.')

  const tasks = result.sections[1]
  assert.equal(tasks.kind, 'task')
  assert.equal(tasks.items[0].status, 'done')
  assert.equal(tasks.items[1].title, 'Add validation')
  assert.equal(tasks.items[1].status, 'in-progress')
})

test('unrecognized sections import as notes with a warning', () => {
  const result = parseSddMarkdown('## Random Musings\n\n### Idea one\n')

  assert.equal(result.sections[0].kind, 'note')
  assert.ok(
    result.warnings.some((warning) => warning.includes('Random Musings'))
  )
})

test('content before any section produces a warning', () => {
  const result = parseSddMarkdown('Loose intro text with no heading.')

  assert.ok(result.warnings.some((warning) => warning.includes('before any section')))
  assert.equal(result.sections[0].kind, 'note')
})

test('layout creates areas below existing content with kinds', () => {
  const existing = makeState([makeArea('a1', 'note', 'Existing', 0)])
  const result = parseSddMarkdown('## Decisions\n\n### Use Stripe\n')
  const plan = layoutSddImport(result, existing)

  assert.equal(plan.createCount, 1)
  assert.equal(plan.operations.length, 1)

  const operation = plan.operations[0]
  assert.equal(operation.op, 'createArea')

  if (operation.op === 'createArea') {
    assert.equal(operation.area.metadata?.kind, 'decision')
    // Existing area bottom is 140; new content must be well below it.
    assert.ok(operation.area.y > 140)
  }
})

test('anchored items update matching areas instead of duplicating', () => {
  const existing = makeState([makeArea('d1', 'decision', 'Old text', 0)])
  const markdown = [
    '## Decisions',
    '',
    '<!-- cascadery:area:d1 -->',
    '### New decision text',
    '',
    'Updated body.',
  ].join('\n')

  const plan = layoutSddImport(parseSddMarkdown(markdown), existing)

  assert.equal(plan.updateCount, 1)
  assert.equal(plan.createCount, 0)

  const operation = plan.operations[0]
  assert.equal(operation.op, 'updateArea')

  if (operation.op === 'updateArea') {
    assert.equal(operation.areaId, 'd1')
    assert.match(operation.patch.text ?? '', /New decision text/)
    assert.match(operation.patch.text ?? '', /Updated body\./)
  }
})

test('an anchor that no longer exists creates a new area and warns', () => {
  const plan = layoutSddImport(
    parseSddMarkdown('## Decisions\n\n<!-- cascadery:area:gone -->\n### Ghost\n'),
    makeState([])
  )

  assert.equal(plan.createCount, 1)
  assert.ok(plan.warnings.some((warning) => warning.includes('gone')))
})

test('round trip: export then import reproduces structural content', () => {
  const state = makeState([
    makeArea('d1', 'decision', 'Use Stripe', 0),
    makeArea('q1', 'question', 'Apple Pay?', 100),
    makeArea('t1', 'task', 'Wire the form', 200),
  ])
  state.areas[2].metadata = { kind: 'task', status: 'done', tags: [] }

  const { combined } = compileSddBundle(state)
  const plan = layoutSddImport(parseSddMarkdown(combined), makeState([]))

  const kinds = plan.operations
    .filter((operation) => operation.op === 'createArea')
    .map((operation) =>
      operation.op === 'createArea' ? operation.area.metadata?.kind : null
    )

  assert.ok(kinds.includes('decision'))
  assert.ok(kinds.includes('question'))
  assert.ok(kinds.includes('task'))
})

test('re-importing an export updates every anchored area, none created', () => {
  const state = makeState([
    makeArea('d1', 'decision', 'Use Stripe', 0),
    makeArea('t1', 'task', 'Wire the form', 100),
  ])

  const { combined } = compileSddBundle(state)
  const plan = layoutSddImport(parseSddMarkdown(combined), state)

  assert.equal(plan.createCount, 0)
  assert.ok(plan.updateCount >= 2)
  assert.ok(plan.operations.every((operation) => operation.op === 'updateArea'))
})

test('buildSddImportPatch produces an applyable patch', () => {
  const state = makeState([])
  const { patch, createCount } = buildSddImportPatch(
    state,
    CLIENT,
    '## Decisions\n\n### Use Stripe\n\n## Tasks\n\n- [ ] Wire it\n',
    { createPatchId: () => 'patch_1', now: '2026-07-02T00:00:00.000Z' }
  )

  assert.ok(patch)
  assert.equal(createCount, 2)

  const applied = applyAgentPatch(state, patch!, CLIENT, {
    maxOperations: MAX_IMPORT_OPERATIONS,
  })

  assert.equal(applied.ok, true)

  if (applied.ok) {
    assert.equal(applied.state.areas.length, 2)
    const kinds = applied.state.areas.map((area) => getAreaMetadata(area).kind)
    assert.ok(kinds.includes('decision'))
    assert.ok(kinds.includes('task'))
  }
})

test('empty markdown yields no patch and a warning', () => {
  const { patch, warnings } = buildSddImportPatch(
    makeState([]),
    CLIENT,
    '   \n\n'
  )

  assert.equal(patch, null)
  assert.ok(warnings.some((warning) => warning.includes('No importable')))
})

test('spec-kit shaped markdown parses: FR bullets, subsections, and title', () => {
  const markdown = [
    '# Feature Specification: Checkout redesign',
    '',
    '**Feature Branch**: `007-checkout-redesign`',
    '',
    '**Status**: Draft',
    '',
    '## User Scenarios & Testing *(mandatory)*',
    '',
    '### Checkout happy path',
    '',
    'Buyer completes payment.',
    '',
    '### Edge Cases',
    '',
    '- Card declined mid-session',
    '',
    '## Requirements *(mandatory)*',
    '',
    '### Functional Requirements',
    '',
    '<!-- cascadery:area:req1 -->',
    '- **FR-001**: The system shall tokenize cards.',
    '  - Implemented by: T001 (Integrate tokenizer)',
    '- **FR-002**: The system shall log declines.',
    '',
    '## Success Criteria *(mandatory)*',
    '',
    '### Measurable Outcomes',
    '',
    '- [NEEDS CLARIFICATION: success criteria not captured on the canvas]',
    '',
    '## Coverage Gaps',
    '',
    '- Requirement without an implementing task: The system shall log declines.',
    '',
  ].join('\n')

  const parsed = parseSddMarkdown(markdown)

  assert.equal(parsed.title, 'Checkout redesign')

  // The mandatory H2 opens an (empty) requirement section; the Functional
  // Requirements H3 subsection holds the items — aggregate across both.
  const requirementItems = parsed.sections
    .filter((section) => section.kind === 'requirement')
    .flatMap((section) => section.items)
  assert.deepEqual(
    requirementItems.map((item) => [item.title, item.anchorAreaId]),
    [
      ['The system shall tokenize cards.', 'req1'],
      ['The system shall log declines.', null],
    ]
  )

  const scenarioSection = parsed.sections.find(
    (section) => section.kind === 'ui-state'
  )
  assert.ok(scenarioSection)
  assert.equal(scenarioSection.items[0].title, 'Checkout happy path')

  const riskSection = parsed.sections.find(
    (section) => section.kind === 'risk'
  )
  assert.ok(riskSection)

  // Derived/boilerplate content never becomes items.
  const allTitles = parsed.sections.flatMap((section) =>
    section.items.map((item) => item.title)
  )
  assert.ok(!allTitles.some((title) => title.includes('NEEDS CLARIFICATION')))
  assert.ok(!allTitles.some((title) => title.includes('Implemented by')))
  assert.ok(!allTitles.some((title) => title.includes('Feature Branch')))
  assert.ok(
    !allTitles.some((title) =>
      title.includes('Requirement without an implementing task')
    )
  )
})

test('spec-kit task phases parse with T-ids and markers stripped', () => {
  const markdown = [
    '# Tasks: Checkout redesign',
    '',
    '**Input**: Design documents from `/specs/007-checkout-redesign/`',
    '',
    '## Phase 1: Implementation',
    '',
    '- [x] T001 Integrate tokenizer (implements: FR-001)',
    '- [ ] T002 [P] [US1] Add decline logging (blocked)',
    '',
  ].join('\n')

  const parsed = parseSddMarkdown(markdown)
  const taskSection = parsed.sections.find(
    (section) => section.kind === 'task'
  )

  assert.ok(taskSection)
  assert.deepEqual(
    taskSection.items.map((item) => [item.title, item.status]),
    [
      ['Integrate tokenizer', 'done'],
      ['Add decline logging', 'blocked'],
    ]
  )
  // The Tasks: H1 does not become the page title.
  assert.equal(parsed.title, null)
})

test('spec-kit export round-trips onto a blank page', () => {
  const source = makeState([
    makeArea('req1', 'requirement', 'Requirement: The system shall tokenize cards.', 100),
    makeArea('t1', 'task', 'Task: Integrate tokenizer', 200),
    makeArea('r1', 'risk', 'PCI scope creep', 300),
  ])
  const bundle = compileSpecKitBundle(source)
  const combined = bundle.files
    .map((file) => file.contents)
    .join('\n\n')
  const blank = makeState([])
  const result = buildSddImportPatch(blank, CLIENT, combined)

  assert.ok(result.patch)

  const applied = applyAgentPatch(blank, result.patch, CLIENT, {
    maxOperations: MAX_IMPORT_OPERATIONS,
  })

  assert.ok(applied.ok)

  const kinds = applied.state.areas.map(
    (area) => getAreaMetadata(area).kind
  )

  assert.ok(kinds.includes('requirement'))
  assert.ok(kinds.includes('task'))
  assert.ok(kinds.includes('risk'))

  const requirement = applied.state.areas.find(
    (area) => getAreaMetadata(area).kind === 'requirement'
  )

  assert.ok(requirement)
  assert.ok(requirement.type !== 'image')
  assert.match(requirement.text, /The system shall tokenize cards\./)
})
