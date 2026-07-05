import type { AreaState } from './App'
import {
  createAreaLink,
  normalizeAreaMetadata,
  type AreaLink,
  type AreaLinkDirection,
  type AreaLinkEndpoint,
  type AreaMetadata,
} from './areaMetadata.ts'
import {
  createDefaultPageState,
  type PageAppState,
} from './pagePersistence.ts'

type JsonCanvasImportSuccess = {
  ok: true
  state: PageAppState
  warnings: string[]
}

type JsonCanvasImportFailure = {
  ok: false
  error: string
}

export type JsonCanvasImportResult =
  | JsonCanvasImportSuccess
  | JsonCanvasImportFailure

type JsonCanvasNodeRecord = Record<string, unknown> & {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

const JSON_CANVAS_PRESET_COLORS: Record<string, string> = {
  '1': '#ef4444',
  '2': '#f97316',
  '3': '#eab308',
  '4': '#22c55e',
  '5': '#06b6d4',
  '6': '#a855f7',
}

export const parseJsonCanvas = (
  json: string,
  now = new Date().toISOString()
): JsonCanvasImportResult => {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    return {
      ok: false,
      error: 'Import must be valid JSON Canvas.',
    }
  }

  if (!isRecord(value)) {
    return {
      ok: false,
      error: 'Import must be a JSON Canvas object.',
    }
  }

  const rawNodes = Array.isArray(value.nodes) ? value.nodes : []
  const rawEdges = Array.isArray(value.edges) ? value.edges : []
  const warnings: string[] = []
  const validNodes = rawNodes.flatMap((node): JsonCanvasNodeRecord[] => {
    if (!isValidNodeBase(node)) {
      warnings.push('Skipped a node with missing required geometry.')
      return []
    }

    if (!['text', 'file', 'link', 'group'].includes(node.type)) {
      warnings.push(`Unsupported node type "${node.type}" skipped.`)
      return []
    }

    return [node]
  })
  const groupNodes = validNodes.filter((node) => node.type === 'group')
  const areas = validNodes.map((node) =>
    toAreaState(node, groupNodes, now)
  )
  const areaIds = new Set(areas.map((area) => area.id))
  const links = rawEdges.flatMap((edge): AreaLink[] => {
    const link = toAreaLink(edge, areaIds, now)

    if (!link) {
      warnings.push('Skipped an edge with missing nodes.')
      return []
    }

    return [link]
  })

  return {
    ok: true,
    warnings,
    state: {
      page: createDefaultPageState({ now }),
      areas,
      assets: [],
      links,
    },
  }
}

export const offsetJsonCanvasImportState = (
  state: PageAppState,
  existingAreas: AreaState[],
  gap = 60
): PageAppState => {
  if (state.areas.length === 0) return state

  const importedBounds = getAreaBounds(state.areas)
  const existingBounds = getAreaBounds(existingAreas)
  const offsetX =
    existingBounds && importedBounds
      ? existingBounds.x - importedBounds.x
      : 0
  const offsetY =
    existingBounds && importedBounds
      ? existingBounds.y + existingBounds.height + gap - importedBounds.y
      : 0

  return {
    ...state,
    areas: state.areas.map((area) =>
      area.parentId
        ? area
        : {
            ...area,
            x: area.x + offsetX,
            y: area.y + offsetY,
          }
    ),
  }
}

const toAreaState = (
  node: JsonCanvasNodeRecord,
  groups: JsonCanvasNodeRecord[],
  now: string
): AreaState => {
  const parentId = getExplicitParentId(node) ?? getContainingGroupId(node, groups)
  const parent = parentId
    ? groups.find((group) => group.id === parentId)
    : null
  const x = parent ? node.x - parent.x : node.x
  const y = parent ? node.y - parent.y : node.y
  const styles = getStyles(node)
  const metadata = getMetadata(node)
  const base = {
    id: node.id,
    parentId,
    x,
    y,
    width: node.width,
    height: node.height,
    styles,
    ...(metadata ? { metadata } : {}),
    createdAt:
      typeof node['x-cascadery-created-at'] === 'string'
        ? node['x-cascadery-created-at']
        : now,
    updatedAt:
      typeof node['x-cascadery-updated-at'] === 'string'
        ? node['x-cascadery-updated-at']
        : now,
  }

  if (node['x-cascadery-area-type'] === 'image') {
    const asset = isRecord(node['x-cascadery-asset'])
      ? node['x-cascadery-asset']
      : null

    return {
      ...base,
      type: 'image',
      assetId:
        typeof asset?.id === 'string'
          ? asset.id
          : `asset-${node.id}`,
      alt:
        typeof node['x-cascadery-alt'] === 'string'
          ? node['x-cascadery-alt']
          : node.id,
    }
  }

  return {
    ...base,
    text: getNodeText(node),
  }
}

const toAreaLink = (
  value: unknown,
  areaIds: Set<string>,
  now: string
) => {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.fromNode !== 'string' ||
    typeof value.toNode !== 'string' ||
    !areaIds.has(value.fromNode) ||
    !areaIds.has(value.toNode)
  ) {
    return null
  }

  const extension = isRecord(value['x-cascadery-link'])
    ? value['x-cascadery-link']
    : {}
  const direction = getLinkDirection(value)
  const from = getEndpoint(
    extension.from,
    value.fromNode,
    value.fromSide
  )
  const to = getEndpoint(extension.to, value.toNode, value.toSide)

  return createAreaLink({
    id: value.id,
    fromAreaId: value.fromNode,
    toAreaId: value.toNode,
    kind:
      typeof extension.kind === 'string'
        ? extension.kind
        : 'relates-to',
    label: typeof value.label === 'string' ? value.label : undefined,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    visual: isRecord(extension.visual)
      ? extension.visual
      : {
          mode: 'simple',
          direction,
          route: 'auto',
          labelVisibility: 'auto',
        },
    schema: isRecord(extension.schema) ? extension.schema : undefined,
    now:
      typeof extension.createdAt === 'string'
        ? extension.createdAt
        : now,
  })
}

const getEndpoint = (
  extensionEndpoint: unknown,
  areaId: string,
  side: unknown
): AreaLinkEndpoint | undefined => {
  if (isRecord(extensionEndpoint)) {
    return extensionEndpoint as AreaLinkEndpoint
  }

  if (!isJsonCanvasSide(side)) return undefined

  return {
    areaId,
    side,
    behavior: 'fixed',
  }
}

const getNodeText = (node: Record<string, unknown>) => {
  if (typeof node['x-cascadery-text'] === 'string') {
    return node['x-cascadery-text']
  }

  if (typeof node.text === 'string') return node.text
  if (typeof node.url === 'string') return node.url
  if (typeof node.file === 'string') return node.file
  if (typeof node.label === 'string') return node.label

  return ''
}

const getMetadata = (node: Record<string, unknown>) => {
  const hasCascaderyMetadata =
    typeof node['x-cascadery-kind'] === 'string' ||
    typeof node['x-cascadery-status'] === 'string' ||
    Array.isArray(node['x-cascadery-tags']) ||
    typeof node['x-cascadery-file-path'] === 'string' ||
    Array.isArray(node['x-cascadery-evidence'])
  const hasNativeMetadata =
    node.type === 'group' ||
    node.type === 'file' ||
    typeof node.file === 'string' ||
    typeof node.url === 'string'

  if (!hasCascaderyMetadata && !hasNativeMetadata) return undefined

  const metadata: Partial<AreaMetadata> = {
    kind:
      typeof node['x-cascadery-kind'] === 'string'
        ? node['x-cascadery-kind']
        : node.type === 'file'
          ? 'file'
          : 'note',
  }

  if (typeof node['x-cascadery-status'] === 'string') {
    metadata.status = node['x-cascadery-status']
  }
  if (Array.isArray(node['x-cascadery-tags'])) {
    metadata.tags = node['x-cascadery-tags'].filter(
      (tag): tag is string => typeof tag === 'string'
    )
  }
  if (typeof node['x-cascadery-file-path'] === 'string') {
    metadata.filePath = node['x-cascadery-file-path']
  } else if (typeof node.file === 'string') {
    metadata.filePath = node.file
  }
  if (typeof node.url === 'string') {
    metadata.url = node.url
  }
  if (Array.isArray(node['x-cascadery-evidence'])) {
    metadata.evidence = node['x-cascadery-evidence'] as AreaMetadata['evidence']
  }

  return normalizeAreaMetadata(metadata)
}

const getStyles = (node: Record<string, unknown>) => {
  const styles = isRecord(node['x-cascadery-styles'])
    ? Object.fromEntries(
        Object.entries(node['x-cascadery-styles']).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === 'string' && typeof entry[1] === 'string'
        )
      )
    : {}
  const color = getCanvasColor(node.color)

  if (color && Object.keys(styles).length === 0) {
    styles['border-color'] = color
  }

  return styles
}

const getCanvasColor = (value: unknown) => {
  if (typeof value !== 'string') return null
  if (JSON_CANVAS_PRESET_COLORS[value]) {
    return JSON_CANVAS_PRESET_COLORS[value]
  }
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) return value

  return null
}

const getContainingGroupId = (
  node: JsonCanvasNodeRecord,
  groups: JsonCanvasNodeRecord[]
) => {
  const group = groups
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => containsNode(candidate, node))
    .sort(
      (left, right) =>
        left.width * left.height - right.width * right.height
    )[0]

  return group?.id ?? null
}

const getExplicitParentId = (node: Record<string, unknown>) =>
  typeof node['x-cascadery-parent-id'] === 'string'
    ? node['x-cascadery-parent-id']
    : null

const containsNode = (
  container: JsonCanvasNodeRecord,
  node: JsonCanvasNodeRecord
) =>
  node.x >= container.x &&
  node.y >= container.y &&
  node.x + node.width <= container.x + container.width &&
  node.y + node.height <= container.y + container.height

const getLinkDirection = (
  edge: Record<string, unknown>
): AreaLinkDirection => {
  const fromEnd = edge.fromEnd === 'arrow'
  const toEnd = edge.toEnd !== 'none'

  if (fromEnd && toEnd) return 'both'
  if (fromEnd) return 'backward'
  if (toEnd) return 'forward'

  return 'none'
}

const getAreaBounds = (areas: AreaState[]) => {
  if (areas.length === 0) return null

  const left = Math.min(...areas.map((area) => area.x))
  const top = Math.min(...areas.map((area) => area.y))
  const right = Math.max(...areas.map((area) => area.x + area.width))
  const bottom = Math.max(...areas.map((area) => area.y + area.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

const isValidNodeBase = (value: unknown): value is JsonCanvasNodeRecord =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.width) &&
  Number.isFinite(value.height)

const isJsonCanvasSide = (
  value: unknown
): value is 'top' | 'right' | 'bottom' | 'left' =>
  value === 'top' ||
  value === 'right' ||
  value === 'bottom' ||
  value === 'left'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
