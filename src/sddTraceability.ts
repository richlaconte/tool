// Requirement→task traceability for spec-driven development (SDD fidelity
// spec). Convention: an `implements` link between a `task` Area and a
// `requirement` Area means the task implements the requirement. The
// canonical direction is task → requirement, but the reverse endpoint
// arrangement is accepted — the link kind plus the two Area kinds carry the
// meaning, so no new link semantics are stored.
import type { AreaState } from './App'
import { getAreaMetadata, type AreaLink } from './areaMetadata.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'

export type SddTraceability = {
  requirements: AreaState[]
  tasks: AreaState[]
  // requirement Area id -> implementing task Area ids (reading order).
  implementedBy: Map<string, string[]>
  // task Area id -> implemented requirement Area ids (reading order).
  implementsRefs: Map<string, string[]>
  uncoveredRequirements: AreaState[]
  unlinkedTasks: AreaState[]
}

export const getSddTraceability = (
  state: PageAppState
): SddTraceability => {
  const ordered = sortAreasByReadingOrder(state)
  const requirements = ordered.filter(
    (area) => getAreaMetadata(area).kind === 'requirement'
  )
  const tasks = ordered.filter(
    (area) => getAreaMetadata(area).kind === 'task'
  )
  const requirementIds = new Set(requirements.map((area) => area.id))
  const taskIds = new Set(tasks.map((area) => area.id))
  const implementedBy = new Map<string, string[]>(
    requirements.map((area) => [area.id, []])
  )
  const implementsRefs = new Map<string, string[]>(
    tasks.map((area) => [area.id, []])
  )

  for (const link of state.links ?? []) {
    const pair = readImplementsPair(link, taskIds, requirementIds)

    if (!pair) continue

    appendUnique(implementedBy.get(pair.requirementId), pair.taskId)
    appendUnique(implementsRefs.get(pair.taskId), pair.requirementId)
  }

  // Deterministic reading order inside each ref list.
  const orderIndex = new Map(ordered.map((area, index) => [area.id, index]))
  const byReadingOrder = (first: string, second: string) =>
    (orderIndex.get(first) ?? 0) - (orderIndex.get(second) ?? 0)

  for (const refs of implementedBy.values()) refs.sort(byReadingOrder)
  for (const refs of implementsRefs.values()) refs.sort(byReadingOrder)

  return {
    requirements,
    tasks,
    implementedBy,
    implementsRefs,
    uncoveredRequirements: requirements.filter(
      (area) => (implementedBy.get(area.id) ?? []).length === 0
    ),
    unlinkedTasks: tasks.filter(
      (area) => (implementsRefs.get(area.id) ?? []).length === 0
    ),
  }
}

export const hasSddTraceabilityContent = (
  traceability: SddTraceability
) => traceability.requirements.length > 0

const readImplementsPair = (
  link: AreaLink,
  taskIds: Set<string>,
  requirementIds: Set<string>
): { taskId: string; requirementId: string } | null => {
  if (link.kind !== 'implements') return null

  if (
    taskIds.has(link.fromAreaId) &&
    requirementIds.has(link.toAreaId)
  ) {
    return { taskId: link.fromAreaId, requirementId: link.toAreaId }
  }

  if (
    requirementIds.has(link.fromAreaId) &&
    taskIds.has(link.toAreaId)
  ) {
    return { taskId: link.toAreaId, requirementId: link.fromAreaId }
  }

  return null
}

const appendUnique = (list: string[] | undefined, value: string) => {
  if (list && !list.includes(value)) list.push(value)
}

// Same reading order as the SDD exporter (y, then x, then id) — kept local
// to avoid a module cycle with sddExport, which consumes this module.
const sortAreasByReadingOrder = (state: PageAppState) =>
  [...state.areas]
    .filter((area) => area.type !== 'image')
    .map((area) => ({
      area,
      position: getAreaAbsolutePosition(state.areas, area.id),
    }))
    .sort(
      (first, second) =>
        Math.round(first.position.y) - Math.round(second.position.y) ||
        Math.round(first.position.x) - Math.round(second.position.x) ||
        first.area.id.localeCompare(second.area.id)
    )
    .map((entry) => entry.area)
