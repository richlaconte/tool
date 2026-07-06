import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaState } from './App'
import { createAreaLink, type AreaKind } from './areaMetadata.ts'
import { exportAreasAsMermaid } from './mermaidExport.ts'
import { parseMermaidFlowchart } from './mermaidImport.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'

const now = '2026-07-06T12:00:00.000Z'

const makeArea = (
  id: string,
  kind: AreaKind,
  text: string,
  overrides: Partial<AreaState> = {}
): AreaState =>
  ({
    id,
    type: 'text',
    parentId: null,
    x: 0,
    y: 0,
    width: 220,
    height: 100,
    text,
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

test('exports nodes, shaped decisions, labeled edges, and direction by bounds', () => {
  const state = makeState(
    [
      makeArea('a1', 'note', 'Start here', { x: 0, y: 0 }),
      makeArea('a2', 'decision', 'Ship it?', { x: 400, y: 0 }),
      makeArea('a3', 'note', 'Release', { x: 800, y: 0 }),
    ],
    [
      createAreaLink({
        id: 'l1',
        fromAreaId: 'a1',
        toAreaId: 'a2',
        kind: 'relates-to',
        now,
      }),
      createAreaLink({
        id: 'l2',
        fromAreaId: 'a2',
        toAreaId: 'a3',
        kind: 'relates-to',
        label: 'yes',
        now,
      }),
    ]
  )

  const mermaid = exportAreasAsMermaid(state)

  // Wide selection → LR.
  assert.match(mermaid, /^flowchart LR\n/)
  assert.match(mermaid, /n1\["Start here"\]/)
  assert.match(mermaid, /n2\{"Ship it\?"\}/)
  assert.match(mermaid, /n1 --> n2/)
  assert.match(mermaid, /n2 -->\|"yes"\| n3/)
  assert.match(mermaid, /%% positions are layout-derived/)
})

test('link-free Areas export as a valid edge-less flowchart', () => {
  const state = makeState([makeArea('a1', 'note', 'Lonely', { y: 500 })])
  const mermaid = exportAreasAsMermaid(state)

  // A single 220x100 Area is wider than tall, so bounds pick LR.
  assert.match(mermaid, /^flowchart LR\n/)
  assert.match(mermaid, /n1\["Lonely"\]/)
  assert.doesNotMatch(mermaid, /-->/)

  const reimported = parseMermaidFlowchart(mermaid)

  assert.ok(reimported.ok)
  assert.equal(reimported.graph.nodes.length, 1)
})

test('nesting exports as subgraphs; lossy fields are listed in the comment', () => {
  const state = makeState(
    [
      makeArea('parent', 'component', 'Backend', {
        width: 500,
        height: 300,
      }),
      makeArea('child', 'task', 'Gateway', {
        parentId: 'parent',
        x: 20,
        y: 40,
        metadata: { kind: 'task', status: 'done', tags: [] },
        styles: { border: '1px solid red' },
      } as Partial<AreaState>),
      makeArea('loose', 'note', 'Client', { x: 0, y: 400 }),
    ],
    [
      createAreaLink({
        id: 'l1',
        fromAreaId: 'loose',
        toAreaId: 'child',
        kind: 'depends-on',
        now,
      }),
      createAreaLink({
        id: 'l2',
        fromAreaId: 'child',
        toAreaId: 'loose',
        kind: 'references',
        now,
        visual: { direction: 'none' },
      }),
    ]
  )

  const mermaid = exportAreasAsMermaid(state)

  assert.match(mermaid, /subgraph n1_group\["Backend"\]/)
  assert.match(mermaid, /n2\["Gateway"\]/)
  assert.match(mermaid, /end\n/)
  // Unlabeled semantic kinds surface as edge labels.
  assert.match(mermaid, /n3 -->\|"depends-on"\| n2/)
  // direction none → open edge.
  assert.match(mermaid, /n2 ---\|"references"\| n3/)
  assert.match(mermaid, /%% lossy: /)
  assert.match(mermaid, /Area status/)
  assert.match(mermaid, /Area CSS styles/)
})

test('selection export includes descendants and round-trips structurally', () => {
  const state = makeState(
    [
      makeArea('parent', 'note', 'Group', { width: 600, height: 300 }),
      makeArea('m1', 'note', 'Member one', {
        parentId: 'parent',
        x: 20,
        y: 40,
      }),
      makeArea('m2', 'decision', 'Member decision', {
        parentId: 'parent',
        x: 260,
        y: 40,
      }),
      makeArea('outside', 'note', 'Not selected', { y: 900 }),
    ],
    [
      createAreaLink({
        id: 'l1',
        fromAreaId: 'm1',
        toAreaId: 'm2',
        kind: 'relates-to',
        label: 'checks',
        now,
      }),
      createAreaLink({
        id: 'l2',
        fromAreaId: 'm1',
        toAreaId: 'outside',
        kind: 'relates-to',
        now,
      }),
    ]
  )

  const mermaid = exportAreasAsMermaid(state, { areaIds: ['parent'] })

  assert.doesNotMatch(mermaid, /Not selected/)

  const reimported = parseMermaidFlowchart(mermaid)

  assert.ok(reimported.ok)
  // The parent round-trips as the subgraph itself, not as a node.
  assert.deepEqual(
    reimported.graph.nodes.map((node) => node.label).sort(),
    ['Member decision', 'Member one'].sort()
  )
  assert.equal(reimported.graph.subgraphs.length, 1)
  assert.equal(reimported.graph.subgraphs[0].title, 'Group')
  assert.equal(reimported.graph.edges.length, 1)
  assert.equal(reimported.graph.edges[0].label, 'checks')

  const memberOne = reimported.graph.nodes.find(
    (node) => node.label === 'Member one'
  )
  const decision = reimported.graph.nodes.find(
    (node) => node.label === 'Member decision'
  )

  assert.ok(memberOne && decision)
  assert.equal(memberOne.subgraphId, reimported.graph.subgraphs[0].id)
  assert.equal(decision.shape, 'diamond')
})

test('quotes in labels are escaped so the block stays parseable', () => {
  const state = makeState([
    makeArea('a1', 'note', 'Say "hello" politely'),
  ])
  const mermaid = exportAreasAsMermaid(state)

  assert.match(mermaid, /#quot;hello#quot;/)

  const reimported = parseMermaidFlowchart(mermaid)

  assert.ok(reimported.ok)
})
