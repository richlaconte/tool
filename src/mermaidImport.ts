// Mermaid flowchart import (Mermaid interop spec).
//
// Parses a deliberate *subset* of Mermaid `flowchart`/`graph` syntax into
// editable canvas structure: direction headers, nodes with label shapes,
// edges with labels, and one level of `subgraph`/`end`. Everything outside
// the subset (classDefs, styles, click handlers, `&` fan-outs, nested
// subgraphs, other diagram types) fails with a line-anchored error rather
// than silently dropping content — all-or-nothing, matching the JSON
// Canvas import contract. Layout is layered by graph depth along the
// declared direction; humans rearrange afterward (SDD-import principle:
// no layout cleverness).
import type { AreaState, TextAreaState } from './App'
import {
  createAreaLink,
  type AreaKind,
  type AreaLink,
} from './areaMetadata.ts'
import type {
  AgentClient,
  AgentPatch,
  AgentPatchOperation,
} from './agentInterface.ts'
import { createAgentOperationsPatch } from './agentInterface.ts'
import type { PageAppState } from './pagePersistence.ts'

export type MermaidNodeShape =
  | 'rect'
  | 'round'
  | 'diamond'
  | 'stadium'
  | 'subroutine'

export type MermaidNode = {
  id: string
  label: string
  shape: MermaidNodeShape
  subgraphId: string | null
}

export type MermaidEdgeStyle = 'solid' | 'open' | 'dotted' | 'thick'

export type MermaidEdge = {
  fromId: string
  toId: string
  label?: string
  style: MermaidEdgeStyle
}

export type MermaidSubgraph = {
  id: string
  title: string
}

export type MermaidDirection = 'TD' | 'TB' | 'LR' | 'RL'

export type MermaidGraph = {
  direction: MermaidDirection
  nodes: MermaidNode[]
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
}

export type MermaidParseResult =
  | { ok: true; graph: MermaidGraph }
  | { ok: false; error: string; line: number }

const NODE_WIDTH = 220
const NODE_HEIGHT = 100
const LAYER_GAP = 80
const SIBLING_GAP = 40
const SUBGRAPH_PADDING = 24
const SUBGRAPH_TITLE_HEIGHT = 44

// `{decision}` diamonds map to the decision kind; every other shape maps
// to note. Kinds are cheap to set after import (spec's open question:
// keep only the decision mapping in v1).
const SHAPE_KIND: Record<MermaidNodeShape, AreaKind> = {
  rect: 'note',
  round: 'note',
  diamond: 'decision',
  stadium: 'note',
  subroutine: 'note',
}

// Order matters: longest opener first so `([` wins over `(`.
const SHAPE_DELIMITERS: Array<{
  open: string
  close: string
  shape: MermaidNodeShape
}> = [
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'diamond' },
]

// Edge operators, longest first. `---` before `--` matters.
const EDGE_OPERATORS: Array<{ token: string; style: MermaidEdgeStyle }> = [
  { token: '-.->', style: 'dotted' },
  { token: '==>', style: 'thick' },
  { token: '-->', style: 'solid' },
  { token: '---', style: 'open' },
]

const UNSUPPORTED_DIAGRAMS =
  /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|pie|mindmap|timeline|gitGraph|quadrantChart)\b/i

const NODE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]*/

export const parseMermaidFlowchart = (
  source: string
): MermaidParseResult => {
  const lines = stripMermaidFence(source).split(/\r?\n/)
  const nodes = new Map<string, MermaidNode>()
  const edges: MermaidEdge[] = []
  const subgraphs: MermaidSubgraph[] = []

  let direction: MermaidDirection = 'TD'
  let sawHeader = false
  let currentSubgraph: string | null = null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1
    const line = lines[lineIndex].trim()

    if (!line || line.startsWith('%%')) continue

    if (!sawHeader) {
      if (UNSUPPORTED_DIAGRAMS.test(line)) {
        return {
          ok: false,
          error: `Unsupported diagram type "${line.split(/\s/)[0]}" — only flowchart/graph is supported.`,
          line: lineNumber,
        }
      }

      const header = /^(flowchart|graph)\b\s*(\S*)\s*$/.exec(line)

      if (!header) {
        return {
          ok: false,
          error: 'Expected a "flowchart" or "graph" header.',
          line: lineNumber,
        }
      }

      if (header[2]) {
        const declared = header[2].toUpperCase()

        if (
          declared !== 'TD' &&
          declared !== 'TB' &&
          declared !== 'LR' &&
          declared !== 'RL'
        ) {
          return {
            ok: false,
            error: `Unsupported direction "${header[2]}" — use TD, TB, LR, or RL.`,
            line: lineNumber,
          }
        }

        direction = declared
      }

      sawHeader = true
      continue
    }

    const subgraphStart = /^subgraph\s+(.+)$/.exec(line)

    if (subgraphStart) {
      if (currentSubgraph) {
        return {
          ok: false,
          error: 'Nested subgraphs are outside the supported subset.',
          line: lineNumber,
        }
      }

      const declaration = parseSubgraphDeclaration(subgraphStart[1].trim())

      subgraphs.push(declaration)
      currentSubgraph = declaration.id
      continue
    }

    if (/^end$/i.test(line)) {
      if (!currentSubgraph) {
        return {
          ok: false,
          error: '"end" without an open subgraph.',
          line: lineNumber,
        }
      }

      currentSubgraph = null
      continue
    }

    const statement = parseStatement(line, currentSubgraph, nodes)

    if (!statement.ok) {
      return {
        ok: false,
        error: statement.error,
        line: lineNumber,
      }
    }

    edges.push(...statement.edges)
  }

  if (!sawHeader) {
    return {
      ok: false,
      error: 'Expected a "flowchart" or "graph" header.',
      line: 1,
    }
  }

  if (currentSubgraph) {
    return {
      ok: false,
      error: `Subgraph "${currentSubgraph}" is missing its "end".`,
      line: lines.length,
    }
  }

  if (nodes.size === 0) {
    return {
      ok: false,
      error: 'The diagram declares no nodes.',
      line: lines.length,
    }
  }

  return {
    ok: true,
    graph: {
      direction,
      nodes: [...nodes.values()],
      edges,
      subgraphs,
    },
  }
}

export const stripMermaidFence = (source: string) => {
  const trimmed = source.trim()
  const fenced = /^```(?:mermaid)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed)

  return fenced ? fenced[1] : trimmed
}

// One statement is a chain: node (edge node)*. Chains like
// `A --> B --> C` are common in agent output.
const parseStatement = (
  line: string,
  subgraphId: string | null,
  nodes: Map<string, MermaidNode>
):
  | { ok: true; edges: MermaidEdge[] }
  | { ok: false; error: string } => {
  const edges: MermaidEdge[] = []
  let rest = line
  let previousNodeId: string | null = null
  let pendingEdge: { style: MermaidEdgeStyle; label?: string } | null =
    null

  while (rest.length > 0) {
    const nodeResult = readNode(rest)

    if (!nodeResult) {
      return {
        ok: false,
        error: `Could not parse "${rest.slice(0, 40)}" — outside the supported flowchart subset.`,
      }
    }

    registerNode(nodes, nodeResult.node, subgraphId)

    if (previousNodeId && pendingEdge) {
      edges.push({
        fromId: previousNodeId,
        toId: nodeResult.node.id,
        style: pendingEdge.style,
        ...(pendingEdge.label ? { label: pendingEdge.label } : {}),
      })
    }

    previousNodeId = nodeResult.node.id
    rest = nodeResult.rest.trim()

    if (rest.length === 0) break

    const edgeResult = readEdge(rest)

    if (!edgeResult) {
      return {
        ok: false,
        error: `Expected an edge after "${previousNodeId}" but found "${rest.slice(0, 40)}".`,
      }
    }

    pendingEdge = {
      style: edgeResult.style,
      ...(edgeResult.label ? { label: edgeResult.label } : {}),
    }
    rest = edgeResult.rest.trim()

    if (rest.length === 0) {
      return {
        ok: false,
        error: `Edge after "${previousNodeId}" is missing its target node.`,
      }
    }
  }

  return { ok: true, edges }
}

const readNode = (
  input: string
):
  | {
      node: { id: string; label: string; shape: MermaidNodeShape }
      rest: string
    }
  | null => {
  const idMatch = NODE_ID_PATTERN.exec(input)

  if (!idMatch) return null

  const id = idMatch[0]
  const rest = input.slice(id.length)

  // Shapes outside the subset (cylinder, circle, hexagon, trapezoids,
  // asymmetric) must fail loudly rather than misparse as rectangles.
  for (const opener of ['[(', '((', '{{', '[/', '[\\']) {
    if (rest.startsWith(opener)) return null
  }

  for (const delimiter of SHAPE_DELIMITERS) {
    if (!rest.startsWith(delimiter.open)) continue

    const closeIndex = rest.indexOf(
      delimiter.close,
      delimiter.open.length
    )

    if (closeIndex === -1) return null

    const label = unquoteLabel(
      rest.slice(delimiter.open.length, closeIndex).trim()
    )

    return {
      node: { id, label, shape: delimiter.shape },
      rest: rest.slice(closeIndex + delimiter.close.length),
    }
  }

  return {
    node: { id, label: id, shape: 'rect' },
    rest,
  }
}

const readEdge = (
  input: string
):
  | { style: MermaidEdgeStyle; label?: string; rest: string }
  | null => {
  // `-- label -->` inline-label form.
  const inlineLabel = /^--\s+([^->][^-]*?)\s+-->/.exec(input)

  if (inlineLabel) {
    return {
      style: 'solid',
      label: unquoteLabel(inlineLabel[1].trim()),
      rest: input.slice(inlineLabel[0].length),
    }
  }

  for (const operator of EDGE_OPERATORS) {
    if (!input.startsWith(operator.token)) continue

    let rest = input.slice(operator.token.length).trimStart()
    let label: string | undefined

    // `-->|label|` pipe-label form.
    if (rest.startsWith('|')) {
      const close = rest.indexOf('|', 1)

      if (close === -1) return null

      label = unquoteLabel(rest.slice(1, close).trim())
      rest = rest.slice(close + 1)
    }

    return {
      style: operator.style,
      ...(label ? { label } : {}),
      rest,
    }
  }

  return null
}

const registerNode = (
  nodes: Map<string, MermaidNode>,
  node: { id: string; label: string; shape: MermaidNodeShape },
  subgraphId: string | null
) => {
  const existing = nodes.get(node.id)

  if (!existing) {
    nodes.set(node.id, { ...node, subgraphId })
    return
  }

  // A later declaration with an explicit label/shape refines a bare
  // reference; membership sticks to the first subgraph that named it.
  if (existing.label === existing.id && node.label !== node.id) {
    existing.label = node.label
    existing.shape = node.shape
  }

  if (existing.subgraphId === null && subgraphId !== null) {
    existing.subgraphId = subgraphId
  }
}

const parseSubgraphDeclaration = (declaration: string): MermaidSubgraph => {
  const withLabel = /^([A-Za-z0-9_-]+)\s*\[(.+)\]$/.exec(declaration)

  if (withLabel) {
    return {
      id: withLabel[1],
      title: unquoteLabel(withLabel[2].trim()),
    }
  }

  return {
    id: declaration.replace(/\s+/g, '_'),
    title: unquoteLabel(declaration),
  }
}

const unquoteLabel = (label: string) =>
  /^".*"$/.test(label) ? label.slice(1, -1) : label

export type MermaidImportPlan = {
  areas: AreaState[]
  links: AreaLink[]
}

// Deterministic layered layout. Depth = longest distance from a source
// node (cycle members fall back to their discovery order). TD/TB layer
// along y; LR along x; RL along x with layers reversed.
export const buildMermaidImportPlan = (
  graph: MermaidGraph,
  {
    origin = { x: 120, y: 120 },
    createAreaId,
    createLinkId,
    now = new Date().toISOString(),
  }: {
    origin?: { x: number; y: number }
    createAreaId: (index: number) => string
    createLinkId: (index: number) => string
    now?: string
  }
): MermaidImportPlan => {
  const depths = computeNodeDepths(graph)
  const layers = new Map<number, MermaidNode[]>()

  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 0
    const layer = layers.get(depth) ?? []

    layer.push(node)
    layers.set(depth, layer)
  }

  const vertical = graph.direction === 'TD' || graph.direction === 'TB'
  const layerCount = Math.max(...[...layers.keys()]) + 1
  const positions = new Map<string, { x: number; y: number }>()

  for (const [depth, layer] of [...layers.entries()].sort(
    (first, second) => first[0] - second[0]
  )) {
    const layerIndex =
      graph.direction === 'RL' ? layerCount - 1 - depth : depth

    layer.forEach((node, siblingIndex) => {
      positions.set(node.id, {
        x: vertical
          ? origin.x + siblingIndex * (NODE_WIDTH + SIBLING_GAP)
          : origin.x + layerIndex * (NODE_WIDTH + LAYER_GAP),
        y: vertical
          ? origin.y + depth * (NODE_HEIGHT + LAYER_GAP)
          : origin.y + siblingIndex * (NODE_HEIGHT + SIBLING_GAP),
      })
    })
  }

  const areaIdByNode = new Map<string, string>()
  const areas: AreaState[] = []
  let areaIndex = 0

  // Subgraph parents first so members can reference them.
  const subgraphAreaIds = new Map<string, string>()

  for (const subgraph of graph.subgraphs) {
    const members = graph.nodes.filter(
      (node) => node.subgraphId === subgraph.id
    )

    if (members.length === 0) continue

    const bounds = members.reduce(
      (current, member) => {
        const position = positions.get(member.id) ?? origin

        return {
          minX: Math.min(current.minX, position.x),
          minY: Math.min(current.minY, position.y),
          maxX: Math.max(current.maxX, position.x + NODE_WIDTH),
          maxY: Math.max(current.maxY, position.y + NODE_HEIGHT),
        }
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      }
    )
    const id = createAreaId(areaIndex)

    areaIndex += 1
    subgraphAreaIds.set(subgraph.id, id)
    areas.push({
      id,
      type: 'text',
      parentId: null,
      x: bounds.minX - SUBGRAPH_PADDING,
      y: bounds.minY - SUBGRAPH_TITLE_HEIGHT,
      width: bounds.maxX - bounds.minX + SUBGRAPH_PADDING * 2,
      height:
        bounds.maxY -
        bounds.minY +
        SUBGRAPH_TITLE_HEIGHT +
        SUBGRAPH_PADDING,
      text: subgraph.title,
      styles: {},
      metadata: { kind: 'note', tags: [] },
      createdAt: now,
      updatedAt: now,
    } satisfies TextAreaState)
  }

  for (const node of graph.nodes) {
    const position = positions.get(node.id) ?? origin
    const parentAreaId = node.subgraphId
      ? (subgraphAreaIds.get(node.subgraphId) ?? null)
      : null
    const parent = parentAreaId
      ? areas.find((area) => area.id === parentAreaId)
      : null
    const id = createAreaId(areaIndex)

    areaIndex += 1
    areaIdByNode.set(node.id, id)
    areas.push({
      id,
      type: 'text',
      parentId: parentAreaId,
      // Child coordinates are relative to the parent Area.
      x: parent ? position.x - parent.x : position.x,
      y: parent ? position.y - parent.y : position.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      text: node.label,
      styles: {},
      metadata: { kind: SHAPE_KIND[node.shape], tags: [] },
      createdAt: now,
      updatedAt: now,
    } satisfies TextAreaState)
  }

  const links = graph.edges.flatMap((edge, index) => {
    const fromAreaId = areaIdByNode.get(edge.fromId)
    const toAreaId = areaIdByNode.get(edge.toId)

    if (!fromAreaId || !toAreaId) return []

    // Dotted/thick edge styles import as plain links: the connector
    // system has no stroke-style field (checked against areaMetadata's
    // AreaLinkVisual) — documented lossy, spec's open question resolved.
    return [
      createAreaLink({
        id: createLinkId(index),
        fromAreaId,
        toAreaId,
        kind: 'relates-to',
        ...(edge.label ? { label: edge.label } : {}),
        visual: {
          mode: 'semantic',
          direction: edge.style === 'open' ? 'none' : 'forward',
        },
        now,
      }),
    ]
  })

  return { areas, links }
}

const computeNodeDepths = (graph: MermaidGraph) => {
  const depths = new Map<string, number>()
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const node of graph.nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }

  for (const edge of graph.edges) {
    if (edge.fromId === edge.toId) continue

    incoming.set(edge.toId, (incoming.get(edge.toId) ?? 0) + 1)
    outgoing.get(edge.fromId)?.push(edge.toId)
  }

  const queue = graph.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id)

  for (const id of queue) depths.set(id, 0)

  while (queue.length > 0) {
    const id = queue.shift() as string
    const depth = depths.get(id) ?? 0

    for (const target of outgoing.get(id) ?? []) {
      const nextDepth = Math.max(depths.get(target) ?? 0, depth + 1)

      depths.set(target, nextDepth)

      const remaining = (incoming.get(target) ?? 1) - 1

      incoming.set(target, remaining)

      if (remaining === 0) queue.push(target)
    }
  }

  // Cycle members never reach zero incoming; place them one layer past
  // their deepest resolved predecessor, in declaration order.
  for (const node of graph.nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, (Math.max(0, ...depths.values()) || 0) + 1)
    }
  }

  return depths
}

// MCP path: the same plan expressed as a reviewable proposal.
export const buildMermaidImportPatch = (
  state: PageAppState,
  client: AgentClient,
  source: string,
  options: { createPatchId?: () => string; now?: string } = {}
):
  | {
      ok: true
      patch: AgentPatch
      nodeCount: number
      edgeCount: number
    }
  | { ok: false; error: string; line: number } => {
  const parsed = parseMermaidFlowchart(source)

  if (!parsed.ok) return parsed

  const baseY =
    state.areas.reduce(
      (bottom, area) => Math.max(bottom, area.y + area.height),
      0
    ) + 120
  const plan = buildMermaidImportPlan(parsed.graph, {
    origin: { x: 120, y: baseY },
    createAreaId: (index) => `mermaid_area_${index + 1}`,
    createLinkId: (index) => `mermaid_link_${index + 1}`,
    ...(options.now ? { now: options.now } : {}),
  })
  const operations: AgentPatchOperation[] = [
    ...plan.areas.map(
      (area): AgentPatchOperation => ({
        op: 'createArea',
        area: {
          id: area.id,
          type: 'text',
          text: area.type === 'image' ? '' : area.text,
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          parentId: area.parentId,
          ...(area.metadata ? { metadata: area.metadata } : {}),
        },
      })
    ),
    ...plan.links.map(
      (link): AgentPatchOperation => ({
        op: 'createLink',
        link: {
          id: link.id,
          fromAreaId: link.fromAreaId,
          toAreaId: link.toAreaId,
          kind: link.kind,
          ...(link.label ? { label: link.label } : {}),
          ...(link.visual?.direction
            ? { direction: link.visual.direction }
            : {}),
        },
      })
    ),
  ]

  return {
    ok: true,
    patch: createAgentOperationsPatch(state, client, operations, options),
    nodeCount: parsed.graph.nodes.length,
    edgeCount: parsed.graph.edges.length,
  }
}
