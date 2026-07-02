import type { AreaState } from './App'
import {
  getAreaMetadata,
  type AreaKind,
  type AreaLink,
  type AreaStatus,
} from './areaMetadata.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'

export type SddBundle = {
  spec: string
  plan: string
  tasks: string
  combined: string
}

export type SddSectionDefinition = {
  heading: string
  kinds: AreaKind[]
}

// Section -> Area kind mapping shared with the importer so the two
// directions cannot drift. The first kind is the canonical one an
// importer assigns when it sees the heading.
export const SPEC_SECTIONS: SddSectionDefinition[] = [
  { heading: 'Context', kinds: ['note'] },
  { heading: 'Decisions', kinds: ['decision'] },
  { heading: 'Open Questions', kinds: ['question'] },
  { heading: 'Risks', kinds: ['risk'] },
  { heading: 'Contracts and States', kinds: ['api', 'ui-state'] },
]

export const PLAN_SECTIONS: SddSectionDefinition[] = [
  { heading: 'Architecture', kinds: ['component', 'file'] },
]

export const TASK_SECTION: SddSectionDefinition = {
  heading: 'Tasks',
  kinds: ['task'],
}

const STATUS_LABEL: Record<AreaStatus, string> = {
  open: 'open',
  'in-progress': 'in-progress',
  decided: 'decided',
  done: 'done',
  blocked: 'blocked',
}

export const AREA_ANCHOR_PREFIX = 'cascadery:area:'

export const areaAnchorComment = (areaId: string) =>
  `<!-- ${AREA_ANCHOR_PREFIX}${areaId} -->`

export const parseAreaAnchorComment = (line: string): string | null => {
  const match = /^<!--\s*cascadery:area:([^\s]+)\s*-->$/.exec(
    line.trim()
  )

  return match ? match[1] : null
}

export const compileSddBundle = (state: PageAppState): SddBundle => {
  const spec = compileSpec(state)
  const plan = compilePlan(state)
  const tasks = compileTasks(state)
  const combined = [
    '# spec.md',
    '',
    spec.trimEnd(),
    '',
    '# plan.md',
    '',
    plan.trimEnd(),
    '',
    '# tasks.md',
    '',
    tasks.trimEnd(),
    '',
  ].join('\n')

  return {
    spec,
    plan,
    tasks,
    combined: `${combined.trimEnd()}\n`,
  }
}

const compileSpec = (state: PageAppState) => {
  const lines = [`# ${pageTitle(state)}`, '']

  for (const section of SPEC_SECTIONS) {
    const areas = areasForSection(state, section)

    if (areas.length === 0) continue

    lines.push(`## ${section.heading}`, '')

    for (const area of areas) {
      lines.push(...renderProseItem(area), '')
    }
  }

  return finalizeDocument(lines)
}

const compilePlan = (state: PageAppState) => {
  const lines = [`# ${pageTitle(state)} — Plan`, '']

  for (const section of PLAN_SECTIONS) {
    const areas = areasForSection(state, section)

    if (areas.length === 0) continue

    lines.push(`## ${section.heading}`, '')

    for (const area of areas) {
      lines.push(...renderPlanItem(area, state), '')
    }
  }

  return finalizeDocument(lines)
}

const compileTasks = (state: PageAppState) => {
  const lines = [`# ${pageTitle(state)} — Tasks`, '']
  const taskAreas = areasForSection(state, TASK_SECTION)

  if (taskAreas.length > 0) {
    const { ordered, hasCycle } = orderTasksByDependency(
      taskAreas,
      state.links ?? []
    )

    if (hasCycle) {
      lines.push(
        '<!-- Dependency cycle detected; falling back to reading order. -->',
        ''
      )
    }

    lines.push(`## ${TASK_SECTION.heading}`, '')

    for (const area of ordered) {
      lines.push(...renderTaskItem(area))
    }

    lines.push('')
  }

  return finalizeDocument(lines)
}

const renderProseItem = (area: AreaState) => {
  const metadata = getAreaMetadata(area)
  const status = metadata.status
    ? ` (${STATUS_LABEL[metadata.status]})`
    : ''
  const lines = [
    areaAnchorComment(area.id),
    `### ${areaTitle(area)}${status}`,
  ]
  const body = areaBody(area)

  if (body) lines.push('', body)

  return lines
}

const renderPlanItem = (area: AreaState, state: PageAppState) => {
  const lines = renderProseItem(area)
  const metadata = getAreaMetadata(area)

  for (const evidence of metadata.evidence ?? []) {
    lines.push(
      `- Evidence (${evidence.kind}): ${evidence.label} — \`${evidence.target}\``
    )
  }

  for (const link of outgoingDependencyLinks(area.id, state.links ?? [])) {
    const target = state.areas.find(
      (candidate) => candidate.id === link.toAreaId
    )
    const label = target ? areaTitle(target) : link.toAreaId

    lines.push(`- ${dependencyVerb(link.kind)}: ${label}`)
  }

  return lines
}

const renderTaskItem = (area: AreaState) => {
  const metadata = getAreaMetadata(area)
  const checkbox = metadata.status === 'done' ? '[x]' : '[ ]'
  const annotation =
    metadata.status === 'blocked'
      ? ' (blocked)'
      : metadata.status === 'in-progress'
        ? ' (in-progress)'
        : ''

  return [
    areaAnchorComment(area.id),
    `- ${checkbox} ${areaTitle(area)}${annotation}`,
  ]
}

const areasForSection = (
  state: PageAppState,
  section: SddSectionDefinition
) =>
  sortByReadingOrder(state).filter((area) =>
    section.kinds.includes(getAreaMetadata(area).kind)
  )

export const sortByReadingOrder = (state: PageAppState) =>
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

const DEPENDENCY_LINK_KINDS = new Set(['depends-on', 'blocks'])

const outgoingDependencyLinks = (
  areaId: string,
  links: AreaLink[]
) =>
  links.filter(
    (link) =>
      link.fromAreaId === areaId &&
      (link.kind === 'depends-on' ||
        link.kind === 'implements' ||
        link.kind === 'blocks')
  )

const dependencyVerb = (kind: AreaLink['kind']) => {
  if (kind === 'depends-on') return 'Depends on'
  if (kind === 'blocks') return 'Blocks'
  if (kind === 'implements') return 'Implements'

  return kind
}

// Topological order: an edge means "must come before". `A depends-on B`
// makes B precede A; `A blocks B` makes A precede B. Reading order is
// the stable tiebreak, and a cycle falls back entirely to reading order.
export const orderTasksByDependency = (
  taskAreas: AreaState[],
  links: AreaLink[]
): { ordered: AreaState[]; hasCycle: boolean } => {
  const taskIds = new Set(taskAreas.map((area) => area.id))
  const indexById = new Map(
    taskAreas.map((area, index) => [area.id, index])
  )
  const predecessors = new Map<string, Set<string>>(
    taskAreas.map((area) => [area.id, new Set<string>()])
  )

  for (const link of links) {
    if (!DEPENDENCY_LINK_KINDS.has(link.kind)) continue
    if (!taskIds.has(link.fromAreaId) || !taskIds.has(link.toAreaId)) {
      continue
    }

    const [before, after] =
      link.kind === 'depends-on'
        ? [link.toAreaId, link.fromAreaId]
        : [link.fromAreaId, link.toAreaId]

    if (before === after) continue

    predecessors.get(after)?.add(before)
  }

  const resolved: string[] = []
  const resolvedSet = new Set<string>()

  while (resolved.length < taskAreas.length) {
    const ready = taskAreas
      .filter((area) => !resolvedSet.has(area.id))
      .filter((area) =>
        [...(predecessors.get(area.id) ?? [])].every((id) =>
          resolvedSet.has(id)
        )
      )
      .sort(
        (first, second) =>
          (indexById.get(first.id) ?? 0) - (indexById.get(second.id) ?? 0)
      )

    if (ready.length === 0) {
      return { ordered: taskAreas, hasCycle: true }
    }

    for (const area of ready) {
      resolved.push(area.id)
      resolvedSet.add(area.id)
    }
  }

  return {
    ordered: resolved.map(
      (id) => taskAreas.find((area) => area.id === id) as AreaState
    ),
    hasCycle: false,
  }
}

const DECISION_PREFIX =
  /^(Decision|Task|Risk|Question|Open question):\s*/i

export const areaTitle = (area: AreaState) => {
  if (area.type === 'image') return area.alt.trim() || area.id

  const firstLine = area.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return area.id

  return firstLine
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(DECISION_PREFIX, '')
    .slice(0, 80)
}

const areaBody = (area: AreaState) => {
  if (area.type === 'image') return ''

  const lines = area.text.split(/\r?\n/)
  const firstContentIndex = lines.findIndex(
    (line) => line.trim().length > 0
  )

  if (firstContentIndex === -1) return ''

  return lines
    .slice(firstContentIndex + 1)
    .join('\n')
    .trim()
}

const pageTitle = (state: PageAppState) =>
  state.page.title.trim() || 'Untitled page'

const finalizeDocument = (lines: string[]) =>
  `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
