export const AREA_KINDS = [
  'note',
  'decision',
  'question',
  'task',
  'risk',
  'file',
  'component',
  'api',
  'ui-state',
] as const

export const AREA_STATUSES = [
  'open',
  'in-progress',
  'decided',
  'done',
  'blocked',
] as const

export const AREA_LINK_KINDS = [
  'relates-to',
  'depends-on',
  'implements',
  'blocks',
  'answers',
  'references',
] as const

export type AreaKind = (typeof AREA_KINDS)[number]
export type AreaStatus = (typeof AREA_STATUSES)[number]
export type AreaLinkKind = (typeof AREA_LINK_KINDS)[number]

export type AreaMetadata = {
  kind: AreaKind
  status?: AreaStatus
  tags: string[]
  filePath?: string
  url?: string
}

type AreaWithMetadata = {
  metadata?: AreaMetadata
}

export type AreaLink = {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_AREA_METADATA: AreaMetadata = {
  kind: 'note',
  tags: [],
}

export const getAreaMetadata = (area: AreaWithMetadata): AreaMetadata =>
  normalizeAreaMetadata(area.metadata)

export const setAreaMetadata = <Area extends AreaWithMetadata>(
  area: Area,
  metadata: Partial<AreaMetadata>
): Area => ({
  ...area,
  metadata: normalizeAreaMetadata({
    ...getAreaMetadata(area),
    ...metadata,
  }),
} as Area)

export const createAreaLink = ({
  id,
  fromAreaId,
  toAreaId,
  kind,
  label,
  now = new Date().toISOString(),
}: {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  now?: string
}): AreaLink => ({
  id,
  fromAreaId,
  toAreaId,
  kind,
  ...(label?.trim() ? { label: label.trim() } : {}),
  createdAt: now,
  updatedAt: now,
})

export const removeAreaLinksForDeletedAreas = (
  links: AreaLink[],
  deletedAreaIds: Set<string>
) =>
  links.filter(
    (link) =>
      !deletedAreaIds.has(link.fromAreaId) &&
      !deletedAreaIds.has(link.toAreaId)
  )

export const normalizeAreaMetadata = (
  metadata: Partial<AreaMetadata> | null | undefined
): AreaMetadata => ({
  kind: isAreaKind(metadata?.kind) ? metadata.kind : 'note',
  ...(isAreaStatus(metadata?.status)
    ? { status: metadata.status }
    : {}),
  tags: normalizeTags(metadata?.tags),
  ...(typeof metadata?.filePath === 'string' &&
  metadata.filePath.trim()
    ? { filePath: metadata.filePath.trim() }
    : {}),
  ...(typeof metadata?.url === 'string' && metadata.url.trim()
    ? { url: metadata.url.trim() }
    : {}),
})

export const isAreaKind = (value: unknown): value is AreaKind =>
  typeof value === 'string' &&
  AREA_KINDS.includes(value as AreaKind)

export const isAreaStatus = (value: unknown): value is AreaStatus =>
  typeof value === 'string' &&
  AREA_STATUSES.includes(value as AreaStatus)

export const isAreaLinkKind = (value: unknown): value is AreaLinkKind =>
  typeof value === 'string' &&
  AREA_LINK_KINDS.includes(value as AreaLinkKind)

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return []

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )
}
