import assert from 'node:assert/strict'
import test from 'node:test'

import { getAreaMetadata } from './areaMetadata.ts'
import { applyAgentPatch, type AgentClient } from './agentInterface.ts'
import {
  buildMermaidImportPatch,
  buildMermaidImportPlan,
  parseMermaidFlowchart,
  stripMermaidFence,
} from './mermaidImport.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'

const now = '2026-07-06T12:00:00.000Z'

const CLIENT: AgentClient = {
  id: 'test',
  displayName: 'Test',
  scopes: ['page:read', 'page:search', 'page:suggest', 'page:write'],
}

const makeState = (): PageAppState => ({
  page: createDefaultPageState({ id: 'page-1', now }),
  areas: [],
  assets: [],
  links: [],
})

const planOptions = {
  createAreaId: (index: number) => `a${index + 1}`,
  createLinkId: (index: number) => `l${index + 1}`,
  now,
}

test('parses the supported flowchart subset', () => {
  const result = parseMermaidFlowchart(
    [
      'flowchart LR',
      '    %% a comment line',
      '    A[Start] --> B{Ship it?}',
      '    B -->|yes| C([Release])',
      '    B -- no --> D[[Rework]]',
      '    D -.-> A',
      '    C ==> E(Done)',
      '    E --- F',
    ].join('\n')
  )

  assert.ok(result.ok)
  assert.equal(result.graph.direction, 'LR')
  assert.deepEqual(
    result.graph.nodes.map((node) => [node.id, node.label, node.shape]),
    [
      ['A', 'Start', 'rect'],
      ['B', 'Ship it?', 'diamond'],
      ['C', 'Release', 'stadium'],
      ['D', 'Rework', 'subroutine'],
      ['E', 'Done', 'round'],
      ['F', 'F', 'rect'],
    ]
  )
  assert.deepEqual(
    result.graph.edges.map((edge) => [
      edge.fromId,
      edge.toId,
      edge.label ?? null,
      edge.style,
    ]),
    [
      ['A', 'B', null, 'solid'],
      ['B', 'C', 'yes', 'solid'],
      ['B', 'D', 'no', 'solid'],
      ['D', 'A', null, 'dotted'],
      ['C', 'E', null, 'thick'],
      ['E', 'F', null, 'open'],
    ]
  )
})

test('parses chains, quoted labels, graph headers, and fenced sources', () => {
  const result = parseMermaidFlowchart(
    stripMermaidFence(
      '```mermaid\ngraph TD\n    A["Quoted label"] --> B --> C\n```'
    )
  )

  assert.ok(result.ok)
  assert.equal(result.graph.direction, 'TD')
  assert.equal(result.graph.nodes[0].label, 'Quoted label')
  assert.deepEqual(
    result.graph.edges.map((edge) => [edge.fromId, edge.toId]),
    [
      ['A', 'B'],
      ['B', 'C'],
    ]
  )
})

test('parses one subgraph level and rejects nesting', () => {
  const result = parseMermaidFlowchart(
    [
      'flowchart TD',
      '    subgraph backend[Backend services]',
      '        API[Gateway] --> DB[(store)]',
      '    end',
      '    UI[Client] --> API',
    ].join('\n')
  )

  // `[(` cylinder is outside the subset — expect a line-anchored error.
  assert.equal(result.ok, false)
  assert.ok(!result.ok)
  assert.equal(result.line, 3)

  const supported = parseMermaidFlowchart(
    [
      'flowchart TD',
      '    subgraph backend[Backend services]',
      '        API[Gateway] --> DB[Store]',
      '    end',
      '    UI[Client] --> API',
    ].join('\n')
  )

  assert.ok(supported.ok)
  assert.deepEqual(supported.graph.subgraphs, [
    { id: 'backend', title: 'Backend services' },
  ])
  assert.equal(
    supported.graph.nodes.find((node) => node.id === 'API')?.subgraphId,
    'backend'
  )
  assert.equal(
    supported.graph.nodes.find((node) => node.id === 'UI')?.subgraphId,
    null
  )

  const nested = parseMermaidFlowchart(
    [
      'flowchart TD',
      '    subgraph one[One]',
      '    subgraph two[Two]',
      '    end',
      '    end',
    ].join('\n')
  )

  assert.ok(!nested.ok)
  assert.equal(nested.line, 3)
  assert.match(nested.error, /Nested subgraphs/)
})

test('rejects unsupported diagram types and malformed input with line anchors', () => {
  const sequence = parseMermaidFlowchart('sequenceDiagram\n  A->>B: hi')

  assert.ok(!sequence.ok)
  assert.equal(sequence.line, 1)
  assert.match(sequence.error, /Unsupported diagram type/)

  const danglingEdge = parseMermaidFlowchart(
    'flowchart TD\n    A[Start] -->'
  )

  assert.ok(!danglingEdge.ok)
  assert.equal(danglingEdge.line, 2)

  const strayEnd = parseMermaidFlowchart('flowchart TD\n    end')

  assert.ok(!strayEnd.ok)
  assert.equal(strayEnd.line, 2)

  const badDirection = parseMermaidFlowchart('flowchart XY\n    A --> B')

  assert.ok(!badDirection.ok)
  assert.match(badDirection.error, /Unsupported direction/)

  const empty = parseMermaidFlowchart('flowchart TD\n')

  assert.ok(!empty.ok)
  assert.match(empty.error, /declares no nodes/)
})

test('layout is deterministic, layered by depth, and nests subgraph members', () => {
  const parsed = parseMermaidFlowchart(
    [
      'flowchart TD',
      '    A[Start] --> B[Middle]',
      '    B --> C[End]',
      '    subgraph grp[Group]',
      '        B',
      '    end',
    ].join('\n')
  )

  assert.ok(parsed.ok)

  const plan = buildMermaidImportPlan(parsed.graph, {
    origin: { x: 100, y: 100 },
    ...planOptions,
  })

  // Parent subgraph Area first, then nodes.
  const parent = plan.areas[0]
  const byText = (text: string) =>
    plan.areas.find((area) => area.type !== 'image' && area.text === text)

  assert.equal(parent.type !== 'image' && parent.text, 'Group')

  const middle = byText('Middle')

  assert.ok(middle)
  assert.equal(middle.parentId, parent.id)

  const start = byText('Start')
  const end = byText('End')

  assert.ok(start && end)
  assert.equal(start.parentId, null)
  // TD: depth increases along y.
  assert.ok(end.y > start.y)
  assert.equal(plan.links.length, 2)
  assert.equal(plan.links[0].visual?.direction, 'forward')

  // Determinism: same input, same plan.
  const again = buildMermaidImportPlan(parsed.graph, {
    origin: { x: 100, y: 100 },
    ...planOptions,
  })

  assert.deepEqual(again, plan)
})

test('decision shapes map to decision kind; open edges import undirected', () => {
  const parsed = parseMermaidFlowchart(
    'flowchart TD\n    A{Choose} --> B[Go]\n    B --- C[Peer]'
  )

  assert.ok(parsed.ok)

  const plan = buildMermaidImportPlan(parsed.graph, {
    origin: { x: 0, y: 0 },
    ...planOptions,
  })
  const decision = plan.areas.find(
    (area) => area.type !== 'image' && area.text === 'Choose'
  )

  assert.ok(decision)
  assert.equal(getAreaMetadata(decision).kind, 'decision')
  assert.equal(plan.links[1].visual?.direction, 'none')
})

test('buildMermaidImportPatch produces an applicable proposal with links', () => {
  const state = makeState()
  const result = buildMermaidImportPatch(
    state,
    CLIENT,
    'flowchart TD\n    A[One] -->|then| B[Two]',
    { now }
  )

  assert.ok(result.ok)
  assert.equal(result.nodeCount, 2)
  assert.equal(result.edgeCount, 1)

  const applied = applyAgentPatch(state, result.patch, CLIENT)

  assert.ok(applied.ok)
  assert.equal(applied.state.areas.length, 2)
  assert.equal(applied.state.links?.length, 1)
  assert.equal(applied.state.links?.[0].label, 'then')

  // Undo removes the created link again.
  const undone = applyAgentPatch(
    applied.state,
    applied.auditRecord.undoPatch,
    CLIENT
  )

  assert.ok(undone.ok)
  assert.equal(undone.state.areas.length, 0)
  assert.equal(undone.state.links?.length, 0)

  const failed = buildMermaidImportPatch(state, CLIENT, 'classDiagram')

  assert.ok(!failed.ok)
  assert.equal(failed.line, 1)
})
