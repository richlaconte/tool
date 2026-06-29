import type { AreaState, AssetState } from './App'
import { getAreaMetadata } from './areaMetadata.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import {
  serializePageState,
  type PageAppState,
} from './pagePersistence.ts'

export const JSON_CANVAS_MIME_TYPE = 'application/vnd.jsoncanvas+json'
export const MARKDOWN_MIME_TYPE = 'text/markdown'

export type JsonCanvasNode = {
  id: string
  type: 'text' | 'file'
  x: number
  y: number
  width: number
  height: number
  text?: string
  file?: string
  cascadery: Record<string, unknown>
}

export type JsonCanvasEdge = {
  id: string
  fromNode: string
  toNode: string
  toEnd: 'arrow'
  label?: string
  cascadery: Record<string, unknown>
}

export type JsonCanvasExport = {
  nodes: JsonCanvasNode[]
  edges: JsonCanvasEdge[]
  cascadery: {
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

export const exportPageAsMarkdown = (state: PageAppState) => {
  const lines = [`# ${state.page.title || 'Untitled page'}`, '']

  for (const group of MARKDOWN_GROUPS) {
    const groupAreas = state.areas.filter(
      (area) => getAreaMetadata(area).kind === group.kind
    )

    if (groupAreas.length === 0) continue

    lines.push(`## ${group.title}`, '')

    for (const area of groupAreas) {
      lines.push(...renderAreaMarkdown(area, state.assets), '')
    }
  }

  if ((state.links ?? []).length > 0) {
    lines.push('## Links', '')

    for (const link of state.links ?? []) {
      lines.push(
        `- \`${link.fromAreaId}\` -> \`${link.toAreaId}\` (${[
          link.kind,
          link.label,
        ]
          .filter(Boolean)
          .join(', ')})`
      )
    }

    lines.push('')
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
    toNode: link.toAreaId,
    toEnd: 'arrow',
    ...(link.label ? { label: link.label } : {}),
    cascadery: {
      kind: link.kind,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    },
  })),
  cascadery: {
    pageId: state.page.id,
    title: state.page.title,
    schemaVersion: 1,
  },
})

export const stringifyPageAsJsonCanvas = (state: PageAppState) =>
  `${JSON.stringify(exportPageAsJsonCanvas(state), null, 2)}\n`

const renderAreaMarkdown = (
  area: AreaState,
  assets: AssetState[]
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

  if (area.type === 'image') {
    lines.push(`Asset: \`${area.assetId}\``)

    const asset = assets.find((candidate) => candidate.id === area.assetId)
    if (asset && isSafeRemoteUrl(asset.storageKey)) {
      lines.push(`Image URL: ${asset.storageKey}`)
    }

    return lines
  }

  return [...lines, '', area.text]
}

const toJsonCanvasNode = (
  area: AreaState,
  state: PageAppState
): JsonCanvasNode => {
  const position = getAreaAbsolutePosition(state.areas, area.id)
  const base = {
    id: area.id,
    x: Math.round(position.x),
    y: Math.round(position.y),
    width: Math.round(area.width),
    height: Math.round(area.height),
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
      cascadery: {
        areaType: 'image',
        parentId: area.parentId,
        alt: area.alt,
        asset: asset ? redactAsset(asset) : { id: area.assetId },
        metadata: getAreaMetadata(area),
        styles: {
          ...area.styles,
        },
      },
    }
  }

  return {
    ...base,
    type: 'text',
    text: area.text,
    cascadery: {
      areaType: 'text',
      parentId: area.parentId,
      metadata: getAreaMetadata(area),
      styles: {
        ...area.styles,
      },
    },
  }
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
