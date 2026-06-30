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

export const AREA_EVIDENCE_KINDS = [
  'file',
  'symbol',
  'url',
  'issue',
  'pull-request',
  'commit',
  'command',
  'asset',
  'note',
] as const

export type AreaKind = (typeof AREA_KINDS)[number]
export type AreaStatus = (typeof AREA_STATUSES)[number]
export type AreaLinkKind = (typeof AREA_LINK_KINDS)[number]
export type AreaEvidenceKind = (typeof AREA_EVIDENCE_KINDS)[number]

export type AreaEvidenceReference = {
  id: string
  kind: AreaEvidenceKind
  label: string
  target: string
  createdAt: string
  updatedAt?: string
}

export type AreaMetadata = {
  kind: AreaKind
  status?: AreaStatus
  tags: string[]
  filePath?: string
  url?: string
  evidence?: AreaEvidenceReference[]
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
  ...(Array.isArray(metadata?.evidence)
    ? { evidence: normalizeEvidence(metadata.evidence) }
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

export const isAreaEvidenceKind = (
  value: unknown
): value is AreaEvidenceKind =>
  typeof value === 'string' &&
  AREA_EVIDENCE_KINDS.includes(value as AreaEvidenceKind)

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

const normalizeEvidence = (evidence: unknown[]) =>
  evidence
    .filter((reference): reference is AreaEvidenceReference => {
      if (typeof reference !== 'object' || reference === null) {
        return false
      }

      const candidate = reference as Partial<AreaEvidenceReference>

      return (
        typeof candidate.id === 'string' &&
        isAreaEvidenceKind(candidate.kind) &&
        typeof candidate.label === 'string' &&
        typeof candidate.target === 'string' &&
        typeof candidate.createdAt === 'string' &&
        (candidate.updatedAt === undefined ||
          typeof candidate.updatedAt === 'string')
      )
    })
    .map((reference) => ({
      id: reference.id,
      kind: reference.kind,
      label: reference.label.trim() || reference.target.trim(),
      target: reference.target.trim(),
      createdAt: reference.createdAt,
      ...(reference.updatedAt ? { updatedAt: reference.updatedAt } : {}),
    }))
    .filter((reference) => reference.target)
