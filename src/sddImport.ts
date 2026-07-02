import type { AgentClient } from './agentInterface.ts'
import {
  createAgentOperationsPatch,
  MAX_IMPORT_OPERATIONS,
  type AgentPatch,
  type AgentPatchOperation,
} from './agentInterface.ts'
import {
  AREA_STATUSES,
  type AreaKind,
  type AreaStatus,
} from './areaMetadata.ts'
import { getAreaAbsolutePosition } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'
import {
  parseAreaAnchorComment,
  PLAN_SECTIONS,
  SPEC_SECTIONS,
  TASK_SECTION,
} from './sddExport.ts'

export type ImportedItem = {
  anchorAreaId: string | null
  kind: AreaKind
  status?: AreaStatus
  title: string
  body: string
}

export type ImportedSection = {
  heading: string
  kind: AreaKind
  items: ImportedItem[]
}

export type SddImportResult = {
  title: string | null
  sections: ImportedSection[]
  warnings: string[]
}

export type SddImportPlan = {
  operations: AgentPatchOperation[]
  warnings: string[]
  createCount: number
  updateCount: number
}

const COLUMN_WIDTH = 320
const COLUMN_GAP = 60
const ITEM_HEIGHT = 140
const ITEM_GAP = 40
const START_GAP = 120
const BASE_X = 120

const HEADING_KIND = buildHeadingKindMap()

export const parseSddMarkdown = (markdown: string): SddImportResult => {
  const lines = markdown.split(/\r?\n/)
  const sections: ImportedSection[] = []
  const warnings: string[] = []

  let title: string | null = null
  let currentSection: ImportedSection | null = null
  let currentItem: (ImportedItem & { bodyLines: string[] }) | null = null
  let pendingAnchor: string | null = null

  const flushItem = () => {
    if (!currentItem || !currentSection) {
      currentItem = null
      return
    }

    const { bodyLines, ...item } = currentItem

    currentSection.items.push({
      ...item,
      body: bodyLines.join('\n').trim(),
    })
    currentItem = null
  }

  const ensureSection = () => {
    if (currentSection) return currentSection

    const section: ImportedSection = {
      heading: 'Notes',
      kind: 'note',
      items: [],
    }

    sections.push(section)
    currentSection = section
    warnings.push('Content appeared before any section heading; imported as notes.')

    return section
  }

  for (const line of lines) {
    const anchor = parseAreaAnchorComment(line)

    if (anchor) {
      pendingAnchor = anchor
      continue
    }

    const h1 = /^#\s+(.*)$/.exec(line)

    if (h1) {
      flushItem()

      if (title === null && !isBundleFileHeading(h1[1])) {
        title = h1[1].trim()
      }

      continue
    }

    const h2 = /^##\s+(.*)$/.exec(line)

    if (h2) {
      flushItem()

      const heading = h2[1].trim()
      const kind = HEADING_KIND.get(normalizeHeading(heading))

      if (!kind) {
        warnings.push(
          `Unrecognized section "${heading}"; imported as notes.`
        )
      }

      currentSection = {
        heading,
        kind: kind ?? 'note',
        items: [],
      }
      sections.push(currentSection)
      continue
    }

    const h3 = /^###\s+(.*)$/.exec(line)

    if (h3) {
      flushItem()

      const section = ensureSection()
      const { title: itemTitle, status } = parseTitleStatus(h3[1].trim())

      currentItem = {
        anchorAreaId: pendingAnchor,
        kind: section.kind,
        ...(status ? { status } : {}),
        title: itemTitle,
        body: '',
        bodyLines: [],
      }
      pendingAnchor = null
      continue
    }

    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)

    if (task && currentSection && currentSection.kind === 'task') {
      flushItem()

      const checked = task[1].toLowerCase() === 'x'
      const { title: taskTitle, status } = parseTaskItem(
        task[2].trim(),
        checked
      )

      currentSection.items.push({
        anchorAreaId: pendingAnchor,
        kind: 'task',
        ...(status ? { status } : {}),
        title: taskTitle,
        body: '',
      })
      pendingAnchor = null
      continue
    }

    if (line.trim().length === 0) {
      if (currentItem) currentItem.bodyLines.push(line)
      continue
    }

    // Non-empty prose line.
    if (currentItem) {
      currentItem.bodyLines.push(line)
      continue
    }

    // Loose prose under a section (markdown without ### items).
    const section = ensureSection()

    if (section.kind === 'task') {
      // Non-checklist text inside a Tasks section is not a task.
      warnings.push(`Skipped non-task line in Tasks section: "${line.trim().slice(0, 60)}"`)
      continue
    }

    currentItem = {
      anchorAreaId: pendingAnchor,
      kind: section.kind,
      title: line.trim().slice(0, 80),
      body: '',
      bodyLines: [],
    }
    pendingAnchor = null
  }

  flushItem()

  return { title, sections, warnings }
}

export const layoutSddImport = (
  result: SddImportResult,
  existingState: PageAppState
): SddImportPlan => {
  const existingIds = new Set(existingState.areas.map((area) => area.id))
  const baseY = getContentBottom(existingState) + START_GAP
  const operations: AgentPatchOperation[] = []
  const warnings = [...result.warnings]
  let createCount = 0
  let updateCount = 0

  const populatedSections = result.sections.filter(
    (section) => section.items.length > 0
  )

  populatedSections.forEach((section, columnIndex) => {
    section.items.forEach((item, rowIndex) => {
      const text = itemText(item)

      if (item.anchorAreaId && existingIds.has(item.anchorAreaId)) {
        operations.push({
          op: 'updateArea',
          areaId: item.anchorAreaId,
          patch: { text },
        })
        updateCount += 1
        return
      }

      if (item.anchorAreaId) {
        warnings.push(
          `Anchor ${item.anchorAreaId} not found on this page; created a new Area.`
        )
      }

      operations.push({
        op: 'createArea',
        area: {
          type: 'text',
          text,
          x: BASE_X + columnIndex * (COLUMN_WIDTH + COLUMN_GAP),
          y: baseY + rowIndex * (ITEM_HEIGHT + ITEM_GAP),
          width: COLUMN_WIDTH,
          height: ITEM_HEIGHT,
          metadata: {
            kind: item.kind,
            ...(item.status ? { status: item.status } : {}),
            tags: [],
          },
        },
      })
      createCount += 1
    })
  })

  if (operations.length > MAX_IMPORT_OPERATIONS) {
    warnings.push(
      `Import exceeds ${MAX_IMPORT_OPERATIONS} operations; truncated.`
    )

    return {
      operations: operations.slice(0, MAX_IMPORT_OPERATIONS),
      warnings,
      createCount,
      updateCount,
    }
  }

  return { operations, warnings, createCount, updateCount }
}

export const buildSddImportPatch = (
  state: PageAppState,
  client: AgentClient,
  markdown: string,
  options: { createPatchId?: () => string; now?: string } = {}
): {
  patch: AgentPatch | null
  warnings: string[]
  createCount: number
  updateCount: number
} => {
  const parsed = parseSddMarkdown(markdown)
  const plan = layoutSddImport(parsed, state)

  if (plan.operations.length === 0) {
    return {
      patch: null,
      warnings: [
        ...plan.warnings,
        'No importable sections or items were found.',
      ],
      createCount: 0,
      updateCount: 0,
    }
  }

  return {
    patch: createAgentOperationsPatch(
      state,
      client,
      plan.operations,
      options
    ),
    warnings: plan.warnings,
    createCount: plan.createCount,
    updateCount: plan.updateCount,
  }
}

const itemText = (item: ImportedItem) =>
  item.body ? `${item.title}\n\n${item.body}` : item.title

const getContentBottom = (state: PageAppState) =>
  state.areas.reduce((bottom, area) => {
    const position = getAreaAbsolutePosition(state.areas, area.id)

    return Math.max(bottom, position.y + area.height)
  }, 0)

const parseTitleStatus = (
  heading: string
): { title: string; status?: AreaStatus } => {
  const match = /^(.*)\s+\(([^)]+)\)\s*$/.exec(heading)

  if (match) {
    const candidate = match[2].trim().toLowerCase()

    if (AREA_STATUSES.includes(candidate as AreaStatus)) {
      return { title: match[1].trim(), status: candidate as AreaStatus }
    }
  }

  return { title: heading }
}

const parseTaskItem = (
  raw: string,
  checked: boolean
): { title: string; status?: AreaStatus } => {
  const annotation = /^(.*)\s+\((blocked|in-progress)\)\s*$/.exec(raw)

  if (annotation) {
    return {
      title: annotation[1].trim(),
      status: annotation[2] as AreaStatus,
    }
  }

  return {
    title: raw,
    status: checked ? 'done' : 'open',
  }
}

const isBundleFileHeading = (heading: string) =>
  /^(spec|plan|tasks)\.md$/i.test(heading.trim())

function normalizeHeading(heading: string) {
  return heading.trim().toLowerCase()
}

function buildHeadingKindMap() {
  const map = new Map<string, AreaKind>()

  for (const section of [...SPEC_SECTIONS, ...PLAN_SECTIONS, TASK_SECTION]) {
    map.set(normalizeHeading(section.heading), section.kinds[0])
  }

  // Common aliases the exporter does not emit but importers may encounter.
  map.set('questions', 'question')
  map.set('notes', 'note')
  map.set('tasks', 'task')
  map.set('architecture', 'component')

  return map
}
