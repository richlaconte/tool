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
  'contains',
] as const

export const AREA_LINK_ANCHORS = [
  'auto',
  'top',
  'right',
  'bottom',
  'left',
  'center',
] as const

export const AREA_LINK_VISUAL_MODES = [
  'simple',
  'semantic',
  'schema',
] as const

export const AREA_LINK_DIRECTIONS = [
  'none',
  'forward',
  'backward',
  'both',
] as const

export const AREA_LINK_ROUTES = [
  'auto',
  'straight',
  'orthogonal',
] as const

export const AREA_LINK_LABEL_VISIBILITIES = [
  'auto',
  'always',
  'selected',
] as const

export const AREA_LINK_CARDINALITIES = ['one', 'many'] as const

export const AREA_LINK_OPTIONALITIES = [
  'optional',
  'required',
  'mixed',
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
export type AreaLinkAnchor = (typeof AREA_LINK_ANCHORS)[number]
export type AreaLinkVisualMode =
  (typeof AREA_LINK_VISUAL_MODES)[number]
export type AreaLinkDirection =
  (typeof AREA_LINK_DIRECTIONS)[number]
export type AreaLinkRoute = (typeof AREA_LINK_ROUTES)[number]
export type AreaLinkLabelVisibility =
  (typeof AREA_LINK_LABEL_VISIBILITIES)[number]
export type AreaLinkCardinality =
  (typeof AREA_LINK_CARDINALITIES)[number]
export type AreaLinkOptionality =
  (typeof AREA_LINK_OPTIONALITIES)[number]
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

export type AreaLinkEndpoint = {
  areaId: string
  anchor?: AreaLinkAnchor
}

export type AreaLinkVisual = {
  mode: AreaLinkVisualMode
  direction?: AreaLinkDirection
  route?: AreaLinkRoute
  labelVisibility?: AreaLinkLabelVisibility
}

export type AreaLinkSchema = {
  fromCardinality?: AreaLinkCardinality
  toCardinality?: AreaLinkCardinality
  optionality?: AreaLinkOptionality
  fieldLabel?: string
}

export type AreaLink = {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  from?: AreaLinkEndpoint
  to?: AreaLinkEndpoint
  visual?: AreaLinkVisual
  schema?: AreaLinkSchema
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
  from,
  to,
  visual,
  schema,
  now = new Date().toISOString(),
}: {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  from?: AreaLinkEndpoint
  to?: AreaLinkEndpoint
  visual?: Partial<AreaLinkVisual>
  schema?: Partial<AreaLinkSchema>
  now?: string
}): AreaLink =>
  normalizeAreaLink({
    id,
    fromAreaId,
    toAreaId,
    kind,
    ...(label ? { label } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(visual ? { visual: visual as AreaLinkVisual } : {}),
    ...(schema ? { schema: schema as AreaLinkSchema } : {}),
    createdAt: now,
    updatedAt: now,
  })

export const normalizeAreaLink = (link: AreaLink): AreaLink => {
  const label = link.label?.trim()
  const from = normalizeAreaLinkEndpoint(link.from, link.fromAreaId)
  const to = normalizeAreaLinkEndpoint(link.to, link.toAreaId)
  const schema = normalizeAreaLinkSchema(link.schema)

  return {
    id: link.id,
    fromAreaId: link.fromAreaId,
    toAreaId: link.toAreaId,
    kind: link.kind,
    ...(label ? { label } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    visual: normalizeAreaLinkVisual(link.visual),
    ...(schema ? { schema } : {}),
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }
}

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

export const isAreaLinkAnchor = (
  value: unknown
): value is AreaLinkAnchor =>
  typeof value === 'string' &&
  AREA_LINK_ANCHORS.includes(value as AreaLinkAnchor)

export const isAreaLinkVisualMode = (
  value: unknown
): value is AreaLinkVisualMode =>
  typeof value === 'string' &&
  AREA_LINK_VISUAL_MODES.includes(value as AreaLinkVisualMode)

export const isAreaLinkDirection = (
  value: unknown
): value is AreaLinkDirection =>
  typeof value === 'string' &&
  AREA_LINK_DIRECTIONS.includes(value as AreaLinkDirection)

export const isAreaLinkRoute = (
  value: unknown
): value is AreaLinkRoute =>
  typeof value === 'string' &&
  AREA_LINK_ROUTES.includes(value as AreaLinkRoute)

export const isAreaLinkLabelVisibility = (
  value: unknown
): value is AreaLinkLabelVisibility =>
  typeof value === 'string' &&
  AREA_LINK_LABEL_VISIBILITIES.includes(
    value as AreaLinkLabelVisibility
  )

export const isAreaLinkCardinality = (
  value: unknown
): value is AreaLinkCardinality =>
  typeof value === 'string' &&
  AREA_LINK_CARDINALITIES.includes(value as AreaLinkCardinality)

export const isAreaLinkOptionality = (
  value: unknown
): value is AreaLinkOptionality =>
  typeof value === 'string' &&
  AREA_LINK_OPTIONALITIES.includes(value as AreaLinkOptionality)

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

const normalizeAreaLinkEndpoint = (
  endpoint: AreaLinkEndpoint | undefined,
  fallbackAreaId: string
) => {
  if (!isRecord(endpoint)) return undefined

  const areaId =
    typeof endpoint.areaId === 'string' && endpoint.areaId.trim()
      ? endpoint.areaId.trim()
      : fallbackAreaId

  return {
    areaId,
    ...(isAreaLinkAnchor(endpoint.anchor)
      ? { anchor: endpoint.anchor }
      : {}),
  }
}

const normalizeAreaLinkVisual = (
  visual: AreaLinkVisual | undefined
): AreaLinkVisual => ({
  mode: isAreaLinkVisualMode(visual?.mode) ? visual.mode : 'semantic',
  direction: isAreaLinkDirection(visual?.direction)
    ? visual.direction
    : 'forward',
  route: isAreaLinkRoute(visual?.route) ? visual.route : 'auto',
  labelVisibility: isAreaLinkLabelVisibility(visual?.labelVisibility)
    ? visual.labelVisibility
    : 'auto',
})

const normalizeAreaLinkSchema = (
  schema: AreaLinkSchema | undefined
): AreaLinkSchema | undefined => {
  if (!isRecord(schema)) return undefined

  const fieldLabel = schema.fieldLabel?.trim()
  const normalized: AreaLinkSchema = {
    ...(isAreaLinkCardinality(schema.fromCardinality)
      ? { fromCardinality: schema.fromCardinality }
      : {}),
    ...(isAreaLinkCardinality(schema.toCardinality)
      ? { toCardinality: schema.toCardinality }
      : {}),
    ...(isAreaLinkOptionality(schema.optionality)
      ? { optionality: schema.optionality }
      : {}),
    ...(fieldLabel ? { fieldLabel } : {}),
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
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

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
