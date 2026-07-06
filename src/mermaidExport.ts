// Mermaid flowchart export (Mermaid interop spec).
//
// Linked Areas become a `flowchart` block suitable for PRs, docs, and
// GitHub Markdown preview. The mapping is the inverse of mermaidImport:
// decision Areas render as diamonds, everything else as rectangles; one
// level of nesting renders as `subgraph` (deeper descendants flatten into
// their top-level ancestor's subgraph); link direction maps to arrow vs
// open edges. Positions, Area status, CSS styles, and semantic link kinds
// beyond the label have no Mermaid equivalent — they are listed in a
// trailing `%% lossy:` comment, matching the JSON Canvas manifest
// approach.
import type { AreaState } from './App'
import { getAreaMetadata, type AreaLink } from './areaMetadata.ts'
import { getAreaParentId } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'
import { areaTitle, sortByReadingOrder } from './sddExport.ts'

export type MermaidExportOptions = {
  // Restrict to these Areas (descendants included); default: whole page.
  areaIds?: string[]
}

export const exportAreasAsMermaid = (
  state: PageAppState,
  { areaIds }: MermaidExportOptions = {}
): string => {
  const ordered = sortByReadingOrder(state)
  const included = selectAreas(state, ordered, areaIds)
  const includedIds = new Set(included.map((area) => area.id))
  const nodeNames = new Map<string, string>()

  included.forEach((area, index) => {
    nodeNames.set(area.id, `n${index + 1}`)
  })

  const links = (state.links ?? []).filter(
    (link) =>
      includedIds.has(link.fromAreaId) && includedIds.has(link.toAreaId)
  )

  // Group one level of nesting: top-level parents that have included
  // children become subgraphs; deeper descendants flatten into the same
  // subgraph (documented lossy).
  const topAncestor = new Map<string, string | null>()

  for (const area of included) {
    topAncestor.set(area.id, findTopLevelAncestor(state, area, includedIds))
  }

  const subgraphParents = included.filter((area) =>
    included.some(
      (candidate) =>
        candidate.id !== area.id && topAncestor.get(candidate.id) === area.id
    )
  )
  const subgraphParentIds = new Set(subgraphParents.map((area) => area.id))
  const lines = [`flowchart ${pickDirection(included)}`]

  const renderNode = (area: AreaState) => {
    const name = nodeNames.get(area.id)
    const label = escapeMermaidLabel(areaTitle(area))

    return getAreaMetadata(area).kind === 'decision'
      ? `${name}{"${label}"}`
      : `${name}["${label}"]`
  }

  // Subgraph blocks first, then loose nodes.
  for (const parent of subgraphParents) {
    lines.push(
      `    subgraph ${nodeNames.get(parent.id)}_group["${escapeMermaidLabel(
        areaTitle(parent)
      )}"]`
    )

    for (const area of included) {
      if (
        topAncestor.get(area.id) === parent.id &&
        area.id !== parent.id
      ) {
        lines.push(`        ${renderNode(area)}`)
      }
    }

    lines.push('    end')
  }

  for (const area of included) {
    if (subgraphParentIds.has(area.id)) continue
    if (topAncestor.get(area.id) !== null) continue

    lines.push(`    ${renderNode(area)}`)
  }

  for (const link of links) {
    const direction = link.visual?.direction ?? 'forward'
    const [fromId, toId] =
      direction === 'backward'
        ? [link.toAreaId, link.fromAreaId]
        : [link.fromAreaId, link.toAreaId]
    const operator = direction === 'none' ? '---' : '-->'
    const label =
      link.label ?? (link.kind !== 'relates-to' ? link.kind : undefined)
    const labelToken = label
      ? `|"${escapeMermaidLabel(label)}"|`
      : ''

    lines.push(
      `    ${nodeNames.get(fromId)} ${operator}${labelToken} ${nodeNames.get(toId)}`
    )
  }

  const lossy = collectLossyFields(included, links, subgraphParentIds)

  if (lossy.length > 0) {
    lines.push(`%% lossy: ${lossy.join('; ')}`)
  }

  lines.push(
    '%% positions are layout-derived on re-import; Mermaid has no coordinates'
  )

  return `${lines.join('\n')}\n`
}

const selectAreas = (
  state: PageAppState,
  ordered: AreaState[],
  areaIds?: string[]
) => {
  if (!areaIds || areaIds.length === 0) return ordered

  const requested = new Set(areaIds)
  const included = new Set<string>()

  for (const area of ordered) {
    if (requested.has(area.id) || hasAncestorIn(state, area, requested)) {
      included.add(area.id)
    }
  }

  return ordered.filter((area) => included.has(area.id))
}

const hasAncestorIn = (
  state: PageAppState,
  area: AreaState,
  ids: Set<string>
) => {
  let parentId = getAreaParentId(area)

  while (parentId) {
    if (ids.has(parentId)) return true

    const parent = state.areas.find(
      (candidate) => candidate.id === parentId
    )

    parentId = parent ? getAreaParentId(parent) : null
  }

  return false
}

const findTopLevelAncestor = (
  state: PageAppState,
  area: AreaState,
  includedIds: Set<string>
): string | null => {
  let current = area
  let top: string | null = null

  for (;;) {
    const parentId = getAreaParentId(current)

    if (!parentId) return top

    if (includedIds.has(parentId)) top = parentId

    const parent = state.areas.find(
      (candidate) => candidate.id === parentId
    )

    if (!parent) return top

    current = parent
  }
}

// Wide selections read left-to-right; tall ones top-down.
const pickDirection = (areas: AreaState[]) => {
  if (areas.length === 0) return 'TD'

  const bounds = areas.reduce(
    (current, area) => ({
      minX: Math.min(current.minX, area.x),
      minY: Math.min(current.minY, area.y),
      maxX: Math.max(current.maxX, area.x + area.width),
      maxY: Math.max(current.maxY, area.y + area.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )

  return bounds.maxX - bounds.minX > bounds.maxY - bounds.minY
    ? 'LR'
    : 'TD'
}

const escapeMermaidLabel = (label: string) =>
  label.replaceAll('"', '#quot;')

const collectLossyFields = (
  included: AreaState[],
  links: AreaLink[],
  subgraphParentIds: Set<string>
) => {
  const lossy: string[] = []

  if (included.some((area) => getAreaMetadata(area).status)) {
    lossy.push('Area status')
  }

  if (included.some((area) => Object.keys(area.styles).length > 0)) {
    lossy.push('Area CSS styles')
  }

  if (
    included.some(
      (area) =>
        getAreaMetadata(area).kind !== 'note' &&
        getAreaMetadata(area).kind !== 'decision'
    )
  ) {
    lossy.push('Area kinds other than note/decision')
  }

  if ((links ?? []).some((link) => link.label && link.kind !== 'relates-to')) {
    lossy.push('semantic link kinds behind labels')
  }

  if (
    included.some(
      (area) =>
        getAreaParentId(area) &&
        !subgraphParentIds.has(getAreaParentId(area) as string)
    )
  ) {
    lossy.push('nesting deeper than one subgraph level')
  }

  return lossy
}
