import type { AreaState } from './App'
import {
  getAreaMetadata,
  type AreaKind,
  type AreaLink,
  type AreaStatus,
} from './areaMetadata.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'
import {
  getSddTraceability,
  hasSddTraceabilityContent,
  type SddTraceability,
} from './sddTraceability.ts'

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
  { heading: 'Requirements', kinds: ['requirement'] },
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
  const traceability = getSddTraceability(state)
  const spec = compileSpec(state, traceability)
  const plan = compilePlan(state)
  const tasks = compileTasks(state, traceability)
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

const compileSpec = (
  state: PageAppState,
  traceability: SddTraceability
) => {
  const lines = [`# ${pageTitle(state)}`, '']

  for (const section of SPEC_SECTIONS) {
    const areas = areasForSection(state, section)

    if (areas.length === 0) continue

    lines.push(`## ${section.heading}`, '')

    for (const area of areas) {
      lines.push(...renderProseItem(area))

      if (section.kinds.includes('requirement')) {
        lines.push(
          ...renderImplementedByLines(area.id, state, traceability)
        )
      }

      lines.push('')
    }
  }

  lines.push(...renderCoverageGaps(traceability))

  return finalizeDocument(lines)
}

// Requirement→task traceability rendering. Only pages that contain
// requirement Areas produce any of these lines, so pre-existing pages keep
// byte-identical exports.
const renderImplementedByLines = (
  requirementId: string,
  state: PageAppState,
  traceability: SddTraceability
) =>
  (traceability.implementedBy.get(requirementId) ?? []).map((taskId) => {
    const task = state.areas.find((area) => area.id === taskId)

    return `- Implemented by: ${task ? areaTitle(task) : taskId}`
  })

const renderCoverageGaps = (traceability: SddTraceability): string[] => {
  if (!hasSddTraceabilityContent(traceability)) return []
  if (
    traceability.uncoveredRequirements.length === 0 &&
    traceability.unlinkedTasks.length === 0
  ) {
    return []
  }

  const lines = ['## Coverage Gaps', '']

  for (const requirement of traceability.uncoveredRequirements) {
    lines.push(
      `- Requirement without an implementing task: ${areaTitle(requirement)}`
    )
  }

  for (const task of traceability.unlinkedTasks) {
    lines.push(`- Task not linked to a requirement: ${areaTitle(task)}`)
  }

  lines.push('')

  return lines
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

const compileTasks = (
  state: PageAppState,
  traceability: SddTraceability
) => {
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
      lines.push(
        ...renderTaskItem(area, requirementSuffix(area.id, state, traceability))
      )
    }

    lines.push('')
  }

  return finalizeDocument(lines)
}

const requirementSuffix = (
  taskId: string,
  state: PageAppState,
  traceability: SddTraceability
) => {
  const refs = (traceability.implementsRefs.get(taskId) ?? []).map(
    (requirementId) => {
      const requirement = state.areas.find(
        (area) => area.id === requirementId
      )

      return requirement ? areaTitle(requirement) : requirementId
    }
  )

  return refs.length > 0 ? ` — implements: ${refs.join('; ')}` : ''
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

const renderTaskItem = (area: AreaState, suffix = '') => {
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
    `- ${checkbox} ${areaTitle(area)}${annotation}${suffix}`,
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
  /^(Decision|Task|Risk|Question|Open question|Requirement):\s*/i

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

// --- Spec Kit layout profile -------------------------------------------
//
// Headings and artifact shapes below were verified against the github/
// spec-kit templates (templates/spec-template.md, plan-template.md,
// tasks-template.md on the main branch, fetched 2026-07-06). Re-verify on
// Spec Kit releases; the mapping is intentionally a subset: mandatory
// sections are always emitted (with a NEEDS CLARIFICATION placeholder when
// the canvas has no matching content), optional template sections are
// emitted only when matching Areas exist, and Cascadery-specific sections
// (Decisions, Open Questions, Contracts and States, Coverage Gaps) ride
// along as extra sections, which Spec Kit tolerates.

export const SPEC_KIT_TEMPLATE_VERSION =
  'github/spec-kit main templates, verified 2026-07-06'

export const SDD_EXPORT_PROFILES = ['generic', 'spec-kit'] as const

export type SddExportProfile = (typeof SDD_EXPORT_PROFILES)[number]

export const isSddExportProfile = (
  value: unknown
): value is SddExportProfile =>
  typeof value === 'string' &&
  SDD_EXPORT_PROFILES.includes(value as SddExportProfile)

export type SpecKitBundleFile = {
  name: string
  contents: string
}

export type SpecKitBundle = {
  featureDir: string
  files: SpecKitBundleFile[]
}

export const makeSpecKitSlug = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '') || 'feature'

// Cascadery cannot see the repo's existing feature numbering, so the
// number is user-editable and defaults to 001 (spec's open question).
export const normalizeSpecKitFeatureNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(-3)

  return digits ? digits.padStart(3, '0') : '001'
}

export const compileSpecKitBundle = (
  state: PageAppState,
  {
    featureNumber = '001',
    slug,
    now = new Date().toISOString(),
  }: {
    featureNumber?: string
    slug?: string
    now?: string
  } = {}
): SpecKitBundle => {
  const traceability = getSddTraceability(state)
  const featureDir = `${normalizeSpecKitFeatureNumber(featureNumber)}-${
    slug?.trim() ? makeSpecKitSlug(slug) : makeSpecKitSlug(pageTitle(state))
  }`
  const date = now.slice(0, 10)
  const { taskIds, taskOrder } = specKitTaskNumbering(state)
  const requirementIds = specKitRequirementNumbering(traceability)

  return {
    featureDir,
    files: [
      {
        name: 'spec.md',
        contents: compileSpecKitSpec(
          state,
          traceability,
          featureDir,
          date,
          requirementIds,
          taskIds
        ),
      },
      {
        name: 'plan.md',
        contents: compileSpecKitPlan(state, featureDir, date),
      },
      {
        name: 'tasks.md',
        contents: compileSpecKitTasks(
          state,
          traceability,
          featureDir,
          taskOrder,
          taskIds,
          requirementIds
        ),
      },
    ],
  }
}

const NEEDS_CLARIFICATION_SCENARIOS =
  '- [NEEDS CLARIFICATION: user scenarios not captured on the canvas]'
const NEEDS_CLARIFICATION_REQUIREMENTS =
  '- [NEEDS CLARIFICATION: functional requirements not captured on the canvas]'
const NEEDS_CLARIFICATION_SUCCESS =
  '- [NEEDS CLARIFICATION: success criteria not captured on the canvas]'

const compileSpecKitSpec = (
  state: PageAppState,
  traceability: SddTraceability,
  featureDir: string,
  date: string,
  requirementIds: Map<string, string>,
  taskIds: Map<string, string>
) => {
  const lines = [
    `# Feature Specification: ${pageTitle(state)}`,
    '',
    `**Feature Branch**: \`${featureDir}\``,
    '',
    `**Created**: ${date}`,
    '',
    '**Status**: Draft',
    '',
    `**Input**: Exported from Cascadery page "${pageTitle(state)}"`,
    '',
    '## User Scenarios & Testing *(mandatory)*',
    '',
  ]
  const scenarios = areasOfKind(state, 'ui-state')

  if (scenarios.length === 0) {
    lines.push(NEEDS_CLARIFICATION_SCENARIOS, '')
  } else {
    for (const area of scenarios) {
      lines.push(...renderProseItem(area), '')
    }
  }

  const risks = areasOfKind(state, 'risk')

  if (risks.length > 0) {
    lines.push('### Edge Cases', '')

    for (const area of risks) {
      lines.push(areaAnchorComment(area.id), `- ${areaTitle(area)}`)
    }

    lines.push('')
  }

  lines.push(
    '## Requirements *(mandatory)*',
    '',
    '### Functional Requirements',
    ''
  )

  if (traceability.requirements.length === 0) {
    lines.push(NEEDS_CLARIFICATION_REQUIREMENTS, '')
  } else {
    for (const area of traceability.requirements) {
      const frId = requirementIds.get(area.id) ?? 'FR-000'

      lines.push(
        areaAnchorComment(area.id),
        `- **${frId}**: ${areaTitle(area)}`
      )

      for (const line of requirementBodyLines(area)) {
        lines.push(`  ${line}`)
      }

      for (const taskId of traceability.implementedBy.get(area.id) ?? []) {
        const task = state.areas.find((candidate) => candidate.id === taskId)

        lines.push(
          `  - Implemented by: ${taskIds.get(taskId) ?? taskId}${
            task ? ` (${areaTitle(task)})` : ''
          }`
        )
      }
    }

    lines.push('')
  }

  lines.push(
    '## Success Criteria *(mandatory)*',
    '',
    '### Measurable Outcomes',
    '',
    NEEDS_CLARIFICATION_SUCCESS,
    ''
  )

  const notes = areasOfKind(state, 'note')

  if (notes.length > 0) {
    lines.push('## Assumptions', '')

    for (const area of notes) {
      lines.push(...renderProseItem(area), '')
    }
  }

  lines.push(...specKitExtraSections(state))
  lines.push(...renderCoverageGaps(traceability))

  return finalizeDocument(lines)
}

const compileSpecKitPlan = (
  state: PageAppState,
  featureDir: string,
  date: string
) => {
  const lines = [
    `# Implementation Plan: ${pageTitle(state)}`,
    '',
    `**Branch**: \`${featureDir}\` | **Date**: ${date} | **Spec**: spec.md`,
    '',
    '## Summary',
    '',
    `Exported from the Cascadery page "${pageTitle(state)}". Architecture context captured on the canvas follows.`,
    '',
  ]
  const architecture = [
    ...areasOfKind(state, 'component'),
    ...areasOfKind(state, 'file'),
  ]

  if (architecture.length > 0) {
    lines.push('## Technical Context', '')

    for (const area of sortWithinReadingOrder(state, architecture)) {
      lines.push(...renderPlanItem(area, state), '')
    }
  }

  return finalizeDocument(lines)
}

const compileSpecKitTasks = (
  state: PageAppState,
  traceability: SddTraceability,
  featureDir: string,
  taskOrder: AreaState[],
  taskIds: Map<string, string>,
  requirementIds: Map<string, string>
) => {
  const lines = [
    `# Tasks: ${pageTitle(state)}`,
    '',
    `**Input**: Design documents from \`/specs/${featureDir}/\``,
    '',
  ]

  if (taskOrder.length > 0) {
    lines.push('## Phase 1: Implementation', '')

    for (const area of taskOrder) {
      const metadata = getAreaMetadata(area)
      const checkbox = metadata.status === 'done' ? '[x]' : '[ ]'
      const annotation =
        metadata.status === 'blocked'
          ? ' (blocked)'
          : metadata.status === 'in-progress'
            ? ' (in-progress)'
            : ''
      const refs = (traceability.implementsRefs.get(area.id) ?? [])
        .map((requirementId) => requirementIds.get(requirementId))
        .filter(Boolean)
      const refSuffix =
        refs.length > 0 ? ` (implements: ${refs.join(', ')})` : ''

      lines.push(
        areaAnchorComment(area.id),
        `- ${checkbox} ${taskIds.get(area.id) ?? 'T000'} ${areaTitle(area)}${annotation}${refSuffix}`
      )
    }

    lines.push('')
  }

  return finalizeDocument(lines)
}

const specKitExtraSections = (state: PageAppState): string[] => {
  const lines: string[] = []
  const extras: Array<{ heading: string; kinds: AreaKind[] }> = [
    { heading: 'Decisions', kinds: ['decision'] },
    { heading: 'Open Questions', kinds: ['question'] },
    { heading: 'Contracts and States', kinds: ['api'] },
  ]

  for (const section of extras) {
    const areas = section.kinds.flatMap((kind) => areasOfKind(state, kind))

    if (areas.length === 0) continue

    lines.push(`## ${section.heading}`, '')

    for (const area of sortWithinReadingOrder(state, areas)) {
      lines.push(...renderProseItem(area), '')
    }
  }

  return lines
}

const specKitTaskNumbering = (state: PageAppState) => {
  const taskAreas = areasForSection(state, TASK_SECTION)
  const { ordered } = orderTasksByDependency(taskAreas, state.links ?? [])
  const taskIds = new Map(
    ordered.map((area, index) => [
      area.id,
      `T${String(index + 1).padStart(3, '0')}`,
    ])
  )

  return { taskIds, taskOrder: ordered }
}

const specKitRequirementNumbering = (traceability: SddTraceability) =>
  new Map(
    traceability.requirements.map((area, index) => [
      area.id,
      `FR-${String(index + 1).padStart(3, '0')}`,
    ])
  )

const requirementBodyLines = (area: AreaState) => {
  const body = areaBody(area)

  return body ? body.split('\n').filter((line) => line.trim()) : []
}

const areasOfKind = (state: PageAppState, kind: AreaKind) =>
  sortByReadingOrder(state).filter(
    (area) => getAreaMetadata(area).kind === kind
  )

const sortWithinReadingOrder = (
  state: PageAppState,
  areas: AreaState[]
) => {
  const order = new Map(
    sortByReadingOrder(state).map((area, index) => [area.id, index])
  )

  return [...areas].sort(
    (first, second) =>
      (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0)
  )
}
