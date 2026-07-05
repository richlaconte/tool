import type { AreaState, AssetState } from './App'
import { getAreaThread } from './areaComments.ts'
import { getAreaMetadata } from './areaMetadata.ts'
import {
  formatSnippetHeader,
  type ResolvedCodeSnippet,
} from './codeReferences.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import {
  serializePageState,
  type PageAppState,
} from './pagePersistence.ts'

export const JSON_CANVAS_MIME_TYPE = 'application/vnd.jsoncanvas+json'
export const MARKDOWN_MIME_TYPE = 'text/markdown'

export type JsonCanvasNode = {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  x: number
  y: number
  width: number
  height: number
  color?: string
  text?: string
  file?: string
  url?: string
  label?: string
  [key: `x-cascadery-${string}`]: unknown
}

export type JsonCanvasEdge = {
  id: string
  fromNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  fromEnd?: 'none' | 'arrow'
  toNode: string
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  toEnd?: 'none' | 'arrow'
  color?: string
  label?: string
  [key: `x-cascadery-${string}`]: unknown
}

export type JsonCanvasExport = {
  nodes: JsonCanvasNode[]
  edges: JsonCanvasEdge[]
  'x-cascadery-page': {
    pageId: string
    title: string
    schemaVersion: 1
  }
}

const MARKDOWN_GROUPS = [
  {
    title: 'Decisions',
    kind: 'decision',
  },
  {
    title: 'Tasks',
    kind: 'task',
  },
  {
    title: 'Risks',
    kind: 'risk',
  },
  {
    title: 'Questions',
    kind: 'question',
  },
  {
    title: 'Files',
    kind: 'file',
  },
  {
    title: 'Components',
    kind: 'component',
  },
  {
    title: 'APIs',
    kind: 'api',
  },
  {
    title: 'UI States',
    kind: 'ui-state',
  },
  {
    title: 'Areas',
    kind: 'note',
  },
] as const

export const stringifyExportedPageState = (
  state: PageAppState,
  now = new Date().toISOString()
) => `${JSON.stringify(serializePageState(redactShareLinks(state), now), null, 2)}\n`

export const exportPageAsMarkdown = (
  state: PageAppState,
  options: {
    includeComments?: boolean
    resolvedEvidence?: Record<string, ResolvedCodeSnippet>
  } = {}
) => {
  const lines = [`# ${state.page.title || 'Untitled page'}`, '']

  for (const group of MARKDOWN_GROUPS) {
    const groupAreas = state.areas.filter(
      (area) => getAreaMetadata(area).kind === group.kind
    )

    if (groupAreas.length === 0) continue

    lines.push(`## ${group.title}`, '')

    for (const area of groupAreas) {
      lines.push(...renderAreaMarkdown(area, state.assets, options), '')
    }
  }

  if ((state.links ?? []).length > 0) {
    lines.push('## Relationships', '')

    for (const link of state.links ?? []) {
      lines.push(
        `- \`${link.fromAreaId}\` -> \`${link.toAreaId}\` (${renderRelationshipDetails(link)})`
      )
    }

    lines.push('')
  }

  if (options.includeComments && (state.comments ?? []).length > 0) {
    lines.push('## Comments', '')

    for (const area of state.areas) {
      const thread = getAreaThread(state.comments, area.id)
      if (thread.length === 0) continue

      lines.push(`### ${getAreaMarkdownTitle(area)}`, '')

      for (const comment of thread) {
        const status = comment.resolvedAt
          ? `resolved by ${comment.resolvedBy ?? 'unknown'}`
          : 'open'

        lines.push(`- [${status}] ${comment.authorName}: ${comment.text}`)
      }

      lines.push('')
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}

export const exportPageAsJsonCanvas = (
  state: PageAppState
): JsonCanvasExport => ({
  nodes: state.areas.map((area) => toJsonCanvasNode(area, state)),
  edges: (state.links ?? []).map((link) => ({
    id: link.id,
    fromNode: link.fromAreaId,
    ...(link.from?.side ? { fromSide: link.from.side } : {}),
    fromEnd: getJsonCanvasFromEnd(link.visual?.direction),
    toNode: link.toAreaId,
    ...(link.to?.side ? { toSide: link.to.side } : {}),
    toEnd: getJsonCanvasToEnd(link.visual?.direction),
    label: link.label ?? link.kind,
    'x-cascadery-link': {
      kind: link.kind,
      ...(link.from ? { from: link.from } : {}),
      ...(link.to ? { to: link.to } : {}),
      ...(link.visual ? { visual: link.visual } : {}),
      ...(link.schema ? { schema: link.schema } : {}),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    },
  })),
  'x-cascadery-page': {
    pageId: state.page.id,
    title: state.page.title,
    schemaVersion: 1,
  },
})

export const stringifyPageAsJsonCanvas = (state: PageAppState) =>
  `${JSON.stringify(exportPageAsJsonCanvas(state), null, 2)}\n`

const renderRelationshipDetails = (
  link: NonNullable<PageAppState['links']>[number]
) => {
  const details = [link.kind, link.label]

  if (link.visual?.mode && link.visual.mode !== 'semantic') {
    details.push(link.visual.mode)
  }

  if (link.schema?.fromCardinality && link.schema.toCardinality) {
    details.push(
      `${link.schema.fromCardinality}-to-${link.schema.toCardinality}`
    )
  }

  if (link.schema?.optionality) {
    details.push(link.schema.optionality)
  }

  if (link.schema?.fieldLabel) {
    details.push(`field: ${link.schema.fieldLabel}`)
  }

  return details.filter(Boolean).join(', ')
}

const renderAreaMarkdown = (
  area: AreaState,
  assets: AssetState[],
  options: {
    resolvedEvidence?: Record<string, ResolvedCodeSnippet>
  } = {}
) => {
  const metadata = getAreaMetadata(area)
  const lines = [
    `### ${getAreaMarkdownTitle(area)}`,
    area.type === 'image'
      ? `Image Area: \`${area.id}\``
      : `Area: \`${area.id}\``,
  ]

  if (metadata.status) lines.push(`Status: ${metadata.status}`)
  if (metadata.tags.length > 0) {
    lines.push(`Tags: ${metadata.tags.join(', ')}`)
  }
  if (metadata.filePath) lines.push(`File: \`${metadata.filePath}\``)
  if (metadata.url) lines.push(`URL: ${metadata.url}`)
  if ((metadata.evidence ?? []).length > 0) {
    lines.push('Evidence:')
    for (const evidence of metadata.evidence ?? []) {
      lines.push(
        `- ${evidence.kind}: ${evidence.label} (\`${evidence.target}\`)`
      )
      const snippet = options.resolvedEvidence?.[evidence.target]
      if (snippet) {
        lines.push('', formatResolvedSnippet(snippet))
      }
    }
  }

  if (area.type === 'image') {
    lines.push(`Asset: \`${area.assetId}\``)

    const asset = assets.find((candidate) => candidate.id === area.assetId)
    if (asset && isSafeRemoteUrl(asset.storageKey)) {
      lines.push(`Image URL: ${asset.storageKey}`)
    }
    if (asset?.source?.provider === 'giphy') {
      lines.push(`GIF: ${asset.source.title}`)
      lines.push(`Provider URL: ${asset.source.providerUrl}`)
    }

    return lines
  }

  return [...lines, '', area.text]
}

const formatResolvedSnippet = (snippet: ResolvedCodeSnippet) => {
  const header = formatSnippetHeader(snippet)
  const code = snippet.lines.map((line) => line.text).join('\n')

  return [
    `\`\`\`${snippet.language}`,
    `// ${header}`,
    code,
    '```',
  ].join('\n')
}

const toJsonCanvasNode = (
  area: AreaState,
  state: PageAppState
): JsonCanvasNode => {
  const position = getAreaAbsolutePosition(state.areas, area.id)
  const metadata = getAreaMetadata(area)
  const base = {
    id: area.id,
    x: Math.round(position.x),
    y: Math.round(position.y),
    width: Math.round(area.width),
    height: Math.round(area.height),
    ...getJsonCanvasColor(area.styles),
    ...getCascaderyAreaExtensions(area, metadata),
  }
  const hasChildren = state.areas.some(
    (candidate) => candidate.parentId === area.id
  )

  if (hasChildren) {
    return {
      ...base,
      type: 'group',
      label:
        area.type === 'image'
          ? area.alt
          : getAreaMarkdownTitle(area),
      ...(area.type !== 'image'
        ? { 'x-cascadery-text': area.text }
        : {}),
    }
  }

  if (area.type === 'image') {
    const asset = state.assets.find(
      (candidate) => candidate.id === area.assetId
    )
    const imageReference =
      asset && isSafeRemoteUrl(asset.storageKey)
        ? asset.storageKey
        : `asset:${area.assetId}`

    return {
      ...base,
      type: 'text',
      text: `![${escapeMarkdownAlt(area.alt)}](${imageReference})`,
      'x-cascadery-alt': area.alt,
      'x-cascadery-asset': asset
        ? redactAsset(asset)
        : { id: area.assetId },
    }
  }

  if (metadata.url) {
    return {
      ...base,
      type: 'link',
      url: metadata.url,
      'x-cascadery-text': area.text,
    }
  }

  return {
    ...base,
    type: 'text',
    text: area.text,
  }
}

const getCascaderyAreaExtensions = (
  area: AreaState,
  metadata: ReturnType<typeof getAreaMetadata>
) => ({
  'x-cascadery-area-type': area.type === 'image' ? 'image' : 'text',
  'x-cascadery-parent-id': area.parentId,
  'x-cascadery-kind': metadata.kind,
  ...(metadata.status ? { 'x-cascadery-status': metadata.status } : {}),
  'x-cascadery-tags': metadata.tags,
  ...(metadata.filePath
    ? { 'x-cascadery-file-path': metadata.filePath }
    : {}),
  ...(metadata.evidence
    ? { 'x-cascadery-evidence': metadata.evidence }
    : {}),
  'x-cascadery-styles': {
    ...area.styles,
  },
})

const getJsonCanvasColor = (styles: Record<string, string>) => {
  const color =
    getHexColor(styles['border-color']) ??
    getHexColor(styles.border) ??
    getHexColor(styles['background-color']) ??
    getHexColor(styles.background)

  return color ? { color } : {}
}

const getHexColor = (value: string | undefined) => {
  const match = value?.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i)

  return match?.[0]
}

const getJsonCanvasFromEnd = (
  direction: string | undefined
): 'none' | 'arrow' => {
  if (direction === 'backward' || direction === 'both') return 'arrow'

  return 'none'
}

const getJsonCanvasToEnd = (
  direction: string | undefined
): 'none' | 'arrow' => {
  if (direction === 'none' || direction === 'backward') return 'none'

  return 'arrow'
}

const redactShareLinks = (state: PageAppState): PageAppState => ({
  ...state,
  page: {
    ...state.page,
    settings: {
      ...state.page.settings,
      shareLinks: null,
    },
  },
})

const redactAsset = (asset: AssetState) => ({
  id: asset.id,
  kind: asset.kind,
  mimeType: asset.mimeType,
  width: asset.width,
  height: asset.height,
  createdAt: asset.createdAt,
  ...(asset.source
    ? {
        source: asset.source,
      }
    : {}),
  ...(isSafeRemoteUrl(asset.storageKey)
    ? {
        sourceUrl: asset.storageKey,
        exportWarning: 'Remote image URL preserved; binary assets are not bundled.',
      }
    : {}),
})

const getAreaMarkdownTitle = (area: AreaState) => {
  if (area.type === 'image') return area.alt.trim() || area.id

  const firstLine = area.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return area.id

  return firstLine
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^(Decision|Task|Risk|Question|Open question):\s*/i, '')
    .slice(0, 80)
}

const escapeMarkdownAlt = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')

const isSafeRemoteUrl = (value: string) => {
  try {
    const url = new URL(value)

    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
