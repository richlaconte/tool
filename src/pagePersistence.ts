import type { AreaState, AssetState } from './App'
import {
  isAreaKind,
  isAreaEvidenceKind,
  isAreaLinkKind,
  isAreaStatus,
  normalizeAreaMetadata,
  type AreaLink,
  type AreaEvidenceReference,
  type AreaMetadata,
} from './areaMetadata.ts'
import { clampSnapGridSize } from './snapGrid.ts'
import type { ShareLinks } from './shareLinks.ts'
import type { ThemeColorToken } from './themeColors.ts'

export const PAGE_SCHEMA_VERSION = 1
export const PAGE_STORAGE_KEY = 'tool.page.v1'

export type SnapGridSettings = {
  enabled: boolean
  size: number
  visible: boolean
}

export type McpSettings = {
  enabled: boolean
}

export type PageSettings = {
  background: string
  mcp: McpSettings
  snapGrid: SnapGridSettings
  theme: PageThemeSettings
  shareLinks: ShareLinks | null
}

export type PageThemeSettings = {
  colors: ThemeColorToken[]
}

export type PageState = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  settings: PageSettings
}

export type PersistedTextArea = {
  id: string
  type: 'text'
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  text: string
  styles: Record<string, string>
  metadata?: AreaMetadata
  createdAt: string
  updatedAt: string
}

export type PersistedImageArea = {
  id: string
  type: 'image'
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  assetId: string
  alt: string
  styles: Record<string, string>
  metadata?: AreaMetadata
  createdAt: string
  updatedAt: string
}

export type PageJsonSnapshot = {
  schemaVersion: 1
  page: PageState
  areas: Array<PersistedTextArea | PersistedImageArea>
  assets: AssetState[]
  links?: AreaLink[]
}

export type PageAppState = {
  page: PageState
  areas: AreaState[]
  assets: AssetState[]
  links?: AreaLink[]
}

export type ParsePageJsonResult =
  | {
      ok: true
      state: PageAppState
    }
  | {
      ok: false
      error: string
    }

type CreateDefaultPageStateOptions = {
  id?: string
  now?: string
}

const createId = (prefix: string) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Date.now()}`
}

export const createDefaultPageState = ({
  id = createId('page'),
  now = new Date().toISOString(),
}: CreateDefaultPageStateOptions = {}): PageState => ({
  id,
  title: 'Untitled page',
  createdAt: now,
  updatedAt: now,
  settings: {
    background: '#ffffff',
    snapGrid: {
      enabled: false,
      size: 16,
      visible: false,
    },
    theme: {
      colors: [],
    },
    mcp: {
      enabled: false,
    },
    shareLinks: null,
  },
})

export const serializePageState = (
  state: PageAppState,
  now = new Date().toISOString()
): PageJsonSnapshot => {
  const links = (state.links ?? []).map(cloneAreaLink)

  return {
    schemaVersion: PAGE_SCHEMA_VERSION,
    page: {
      ...state.page,
      settings: {
        background: state.page.settings.background,
        snapGrid: {
          enabled: state.page.settings.snapGrid.enabled,
          size: clampSnapGridSize(state.page.settings.snapGrid.size),
          visible: state.page.settings.snapGrid.visible,
        },
        theme: {
          colors: state.page.settings.theme.colors.map((color) => ({
            ...color,
          })),
        },
        mcp: {
          enabled: state.page.settings.mcp.enabled,
        },
        shareLinks: state.page.settings.shareLinks
          ? {
              ...state.page.settings.shareLinks,
            }
          : null,
      },
      updatedAt: now,
    },
    areas: state.areas.map((area) => {
      const metadata = area.metadata
        ? { metadata: normalizeAreaMetadata(area.metadata) }
        : {}

      if (area.type === 'image') {
        return {
          id: area.id,
          type: 'image',
          parentId: area.parentId,
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          assetId: area.assetId,
          alt: area.alt,
          styles: {
            ...area.styles,
          },
          ...metadata,
          createdAt: area.createdAt ?? now,
          updatedAt: area.updatedAt ?? now,
        }
      }

      return {
        id: area.id,
        type: 'text',
        parentId: area.parentId,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        text: area.text,
        styles: {
          ...area.styles,
        },
        ...metadata,
        createdAt: area.createdAt ?? now,
        updatedAt: area.updatedAt ?? now,
      }
    }),
    assets: state.assets.map((asset) => ({
      ...asset,
    })),
    ...(links.length > 0 ? { links } : {}),
  }
}

export const stringifyPageState = (
  state: PageAppState,
  now = new Date().toISOString()
) => `${JSON.stringify(serializePageState(state, now), null, 2)}\n`

export const parsePageJson = (
  json: string
): ParsePageJsonResult => {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    return {
      ok: false,
      error: 'Import must be valid JSON.',
    }
  }

  if (!isRecord(value)) {
    return {
      ok: false,
      error: 'Import must be a page JSON object.',
    }
  }

  if (value.schemaVersion !== PAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Unsupported page JSON schema version.',
    }
  }

  const page = parsePageState(value.page)
  const areas = parseAreas(value.areas)
  const assets = parseAssets(value.assets)
  const links = parseAreaLinks(value.links)

  if (!page || !areas || !assets || !links) {
    return {
      ok: false,
      error: 'Import is missing required page data.',
    }
  }

  return {
    ok: true,
    state: {
      page,
      areas,
      assets,
      links,
    },
  }
}

const parsePageState = (value: unknown): PageState | null => {
  if (!isRecord(value)) return null

  const settings = parsePageSettings(value.settings)

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !settings
  ) {
    return null
  }

  return {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    settings,
  }
}

const parsePageSettings = (
  value: unknown
): PageSettings | null => {
  if (!isRecord(value)) return null

  const snapGrid = value.snapGrid
  const theme = parsePageThemeSettings(value.theme)
  const mcp = parseMcpSettings(value.mcp)
  const shareLinks = parseShareLinks(value.shareLinks)

  if (
    typeof value.background !== 'string' ||
    !isRecord(snapGrid) ||
    typeof snapGrid.enabled !== 'boolean' ||
    typeof snapGrid.size !== 'number' ||
    typeof snapGrid.visible !== 'boolean' ||
    !theme ||
    !mcp ||
    shareLinks === undefined
  ) {
    return null
  }

  return {
    background: value.background,
    snapGrid: {
      enabled: snapGrid.enabled,
      size: clampSnapGridSize(snapGrid.size),
      visible: snapGrid.visible,
    },
    theme,
    mcp,
    shareLinks,
  }
}

const parseMcpSettings = (
  value: unknown
): McpSettings | null => {
  if (value === undefined) {
    return {
      enabled: false,
    }
  }

  if (!isRecord(value) || typeof value.enabled !== 'boolean') {
    return null
  }

  return {
    enabled: value.enabled,
  }
}

const parseShareLinks = (
  value: unknown
): ShareLinks | null | undefined => {
  if (value === undefined || value === null) return null

  if (
    !isRecord(value) ||
    typeof value.pageId !== 'string' ||
    typeof value.editToken !== 'string' ||
    typeof value.viewToken !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    (value.revokedAt !== null && typeof value.revokedAt !== 'string')
  ) {
    return undefined
  }

  return {
    pageId: value.pageId,
    editToken: value.editToken,
    viewToken: value.viewToken,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    revokedAt: value.revokedAt,
  }
}

const parsePageThemeSettings = (
  value: unknown
): PageThemeSettings | null => {
  if (value === undefined) {
    return {
      colors: [],
    }
  }

  if (!isRecord(value) || !Array.isArray(value.colors)) return null

  const colors: ThemeColorToken[] = []

  for (const color of value.colors) {
    if (
      !isRecord(color) ||
      typeof color.id !== 'string' ||
      typeof color.name !== 'string' ||
      typeof color.token !== 'string' ||
      typeof color.value !== 'string' ||
      typeof color.createdAt !== 'string' ||
      typeof color.updatedAt !== 'string'
    ) {
      return null
    }

    colors.push({
      id: color.id,
      name: color.name,
      token: color.token,
      value: color.value,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    })
  }

  return {
    colors,
  }
}

const parseAreas = (value: unknown): AreaState[] | null => {
  if (!Array.isArray(value)) return null

  const areas: AreaState[] = []

  for (const area of value) {
    if (!isRecord(area)) return null

    const styles = parseStyles(area.styles)
    const metadata = parseAreaMetadata(area.metadata)

    if (
      typeof area.id !== 'string' ||
      !isValidParentId(area.parentId) ||
      typeof area.x !== 'number' ||
      typeof area.y !== 'number' ||
      typeof area.width !== 'number' ||
      typeof area.height !== 'number' ||
      !styles ||
      metadata === undefined
    ) {
      return null
    }

    if (area.type === 'image') {
      if (
        typeof area.assetId !== 'string' ||
        typeof area.alt !== 'string'
      ) {
        return null
      }

      areas.push({
        id: area.id,
        type: 'image',
        parentId: area.parentId ?? null,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        assetId: area.assetId,
        alt: area.alt,
        styles,
        ...(metadata ? { metadata } : {}),
        createdAt:
          typeof area.createdAt === 'string'
            ? area.createdAt
            : undefined,
        updatedAt:
          typeof area.updatedAt === 'string'
            ? area.updatedAt
            : undefined,
      })
      continue
    }

    if (area.type !== 'text' || typeof area.text !== 'string') {
      return null
    }

    areas.push({
      id: area.id,
      parentId: area.parentId ?? null,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      text: area.text,
      styles,
      ...(metadata ? { metadata } : {}),
      createdAt:
        typeof area.createdAt === 'string'
          ? area.createdAt
          : undefined,
      updatedAt:
        typeof area.updatedAt === 'string'
          ? area.updatedAt
          : undefined,
    })
  }

  return areas
}

const parseAreaMetadata = (
  value: unknown
): AreaMetadata | null | undefined => {
  if (value === undefined) return null
  if (!isRecord(value) || !isAreaKind(value.kind)) return undefined

  if (value.status !== undefined && !isAreaStatus(value.status)) {
    return undefined
  }

  if (!Array.isArray(value.tags)) return undefined

  if (
    value.filePath !== undefined &&
    typeof value.filePath !== 'string'
  ) {
    return undefined
  }

  if (value.url !== undefined && typeof value.url !== 'string') {
    return undefined
  }

  const evidence = parseAreaEvidence(value.evidence)
  if (evidence === undefined) return undefined

  if (!value.tags.every((tag) => typeof tag === 'string')) {
    return undefined
  }

  return normalizeAreaMetadata({
    kind: value.kind,
    ...(value.status ? { status: value.status } : {}),
    tags: value.tags,
    ...(value.filePath ? { filePath: value.filePath } : {}),
    ...(value.url ? { url: value.url } : {}),
    ...(evidence ? { evidence } : {}),
  })
}

const parseAreaEvidence = (
  value: unknown
): AreaEvidenceReference[] | null | undefined => {
  if (value === undefined) return null
  if (!Array.isArray(value)) return undefined

  const evidence: AreaEvidenceReference[] = []

  for (const reference of value) {
    if (
      !isRecord(reference) ||
      typeof reference.id !== 'string' ||
      !isAreaEvidenceKind(reference.kind) ||
      typeof reference.label !== 'string' ||
      typeof reference.target !== 'string' ||
      typeof reference.createdAt !== 'string' ||
      (reference.updatedAt !== undefined &&
        typeof reference.updatedAt !== 'string')
    ) {
      return undefined
    }

    evidence.push({
      id: reference.id,
      kind: reference.kind,
      label: reference.label,
      target: reference.target,
      createdAt: reference.createdAt,
      ...(reference.updatedAt
        ? { updatedAt: reference.updatedAt }
        : {}),
    })
  }

  return evidence
}

const parseAreaLinks = (value: unknown): AreaLink[] | null => {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const links: AreaLink[] = []

  for (const link of value) {
    if (
      !isRecord(link) ||
      typeof link.id !== 'string' ||
      typeof link.fromAreaId !== 'string' ||
      typeof link.toAreaId !== 'string' ||
      !isAreaLinkKind(link.kind) ||
      (link.label !== undefined && typeof link.label !== 'string') ||
      typeof link.createdAt !== 'string' ||
      typeof link.updatedAt !== 'string'
    ) {
      return null
    }

    links.push(cloneAreaLink(link as AreaLink))
  }

  return links
}

const parseAssets = (value: unknown): AssetState[] | null => {
  if (!Array.isArray(value)) return null

  const assets: AssetState[] = []

  for (const asset of value) {
    if (
      !isRecord(asset) ||
      asset.kind !== 'image' ||
      typeof asset.id !== 'string' ||
      typeof asset.mimeType !== 'string' ||
      typeof asset.width !== 'number' ||
      typeof asset.height !== 'number' ||
      typeof asset.storageKey !== 'string' ||
      typeof asset.createdAt !== 'string'
    ) {
      return null
    }

    assets.push({
      id: asset.id,
      kind: 'image',
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      storageKey: asset.storageKey,
      createdAt: asset.createdAt,
    })
  }

  return assets
}

const parseStyles = (
  value: unknown
): Record<string, string> | null => {
  if (!isRecord(value)) return null

  const styles: Record<string, string> = {}

  for (const [property, propertyValue] of Object.entries(value)) {
    if (typeof propertyValue !== 'string') return null

    styles[property] = propertyValue
  }

  return styles
}

const isValidParentId = (value: unknown) =>
  value === undefined || value === null || typeof value === 'string'

const cloneAreaLink = (link: AreaLink): AreaLink => ({
  id: link.id,
  fromAreaId: link.fromAreaId,
  toAreaId: link.toAreaId,
  kind: link.kind,
  ...(link.label ? { label: link.label } : {}),
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
})

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
