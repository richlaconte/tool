import type { AreaState } from './App'
import type {
  AreaKind,
  AreaLink,
  AreaLinkKind,
  AreaStatus,
} from './areaMetadata.ts'
import type { PageAppState } from './pagePersistence.ts'

export type ContextKitArea = {
  id: string
  kind?: AreaKind
  status?: AreaStatus
  tags?: string[]
  text: string
  x: number
  y: number
  width: number
  height: number
  styles?: Record<string, string>
}

export type ContextKitLink = {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
}

export type ContextKit = {
  id: string
  icon: string
  title: string
  description: string
  areas: ContextKitArea[]
  links?: ContextKitLink[]
}

export type InsertContextKitOptions = {
  createAreaId: (index: number) => string
  createLinkId: (index: number) => string
  now?: string
  offsetX?: number
  offsetY?: number
}

export type InsertContextKitResult = PageAppState & {
  selectedAreaId: string | null
}

const plainStyles = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  'box-shadow': '0 1px 2px rgb(15 23 42 / 8%)',
}

const accentStyles = {
  background: '#f8fafc',
  border: '1px solid #94a3b8',
}

export const CONTEXT_KITS: ContextKit[] = [
  {
    id: 'implementation-map',
    icon: 'map',
    title: 'Implementation Map',
    description: 'Plan a feature before touching code.',
    areas: [
      area('goal', 'Goal\n\nWhat should change, and why?', 120, 120, 'note', ['goal']),
      area('files', 'Files/components touched\n\n- ', 500, 120, 'file'),
      area('decisions', 'Decisions\n\n- ', 120, 320, 'decision'),
      area('risks', 'Risks\n\n- ', 500, 320, 'risk'),
      area('tasks', 'Tasks\n\n- [ ] ', 120, 520, 'task'),
      area('validation', 'Validation plan\n\n- ', 500, 520, 'task', ['validation']),
    ],
    links: [
      link('goal-decisions', 'goal', 'decisions', 'relates-to'),
      link('decisions-tasks', 'decisions', 'tasks', 'implements'),
      link('risks-validation', 'risks', 'validation', 'depends-on'),
    ],
  },
  {
    id: 'visual-rfc',
    icon: 'branches',
    title: 'Visual RFC',
    description: 'Compare tradeoffs and capture a decision.',
    areas: [
      area('problem', 'Problem\n\nWhat are we solving?', 120, 120, 'question'),
      area('option-a', 'Option A\n\nPros:\nCons:', 120, 320, 'note'),
      area('option-b', 'Option B\n\nPros:\nCons:', 500, 320, 'note'),
      area('decision', 'Decision\n\nChosen path:', 310, 540, 'decision'),
      area('questions', 'Follow-up questions\n\n- ', 500, 120, 'question'),
    ],
    links: [
      link('a-decision', 'option-a', 'decision', 'relates-to'),
      link('b-decision', 'option-b', 'decision', 'relates-to'),
    ],
  },
  {
    id: 'ui-state-matrix',
    icon: 'states',
    title: 'UI State Matrix',
    description: 'Map product states before implementation.',
    areas: [
      area('happy', 'Happy path\n\n', 120, 120, 'ui-state'),
      area('empty', 'Empty state\n\n', 500, 120, 'ui-state'),
      area('loading', 'Loading state\n\n', 120, 320, 'ui-state'),
      area('error', 'Error state\n\n', 500, 320, 'ui-state', ['risk']),
      area('readonly', 'Permission/read-only state\n\n', 120, 520, 'ui-state'),
      area('mobile', 'Mobile considerations\n\n', 500, 520, 'ui-state'),
    ],
  },
  {
    id: 'bug-triage',
    icon: 'bug',
    title: 'Bug Triage',
    description: 'Capture reproduction, evidence, and verification.',
    areas: [
      area('symptom', 'Symptom\n\nWhat is broken?', 120, 120, 'risk'),
      area('repro', 'Reproduction steps\n\n1. ', 500, 120, 'task'),
      area('evidence', 'Evidence\n\n/ref ', 120, 320, 'file'),
      area('causes', 'Suspected causes\n\n- ', 500, 320, 'question'),
      area('fix', 'Fix plan\n\n- [ ] ', 120, 520, 'task'),
      area('checks', 'Regression checks\n\n- ', 500, 520, 'task', ['validation']),
    ],
    links: [
      link('symptom-repro', 'symptom', 'repro', 'references'),
      link('repro-evidence', 'repro', 'evidence', 'references'),
      link('fix-checks', 'fix', 'checks', 'depends-on'),
    ],
  },
  {
    id: 'agent-handoff',
    icon: 'handoff',
    title: 'Agent Handoff',
    description: 'Prepare a scoped brief for a coding agent.',
    areas: [
      area('objective', 'Objective\n\n', 120, 120, 'note', ['goal']),
      area('scope', 'Scope\n\nIn:\nOut:', 500, 120, 'note'),
      area('constraints', 'Constraints\n\n- ', 120, 320, 'risk'),
      area('files', 'Relevant files\n\n/ref ', 500, 320, 'file'),
      area('criteria', 'Acceptance criteria\n\n- ', 120, 520, 'task'),
      area('review', 'Review notes\n\n- ', 500, 520, 'question'),
    ],
    links: [
      link('objective-scope', 'objective', 'scope', 'relates-to'),
      link('scope-criteria', 'scope', 'criteria', 'implements'),
      link('files-review', 'files', 'review', 'references'),
    ],
  },
  {
    id: 'sprint-retro',
    icon: 'cycle',
    title: 'Sprint Retro',
    description: 'Reflect on the sprint and choose next actions.',
    areas: [
      area(
        'sprint-context',
        'Sprint context\n\nGoal:\nShipped:\nSurprises:',
        120,
        120,
        'note',
        ['retro']
      ),
      area('went-well', 'Went well\n\n- ', 500, 120, 'note', [
        'retro',
      ]),
      area(
        'needs-attention',
        'Needs attention\n\n- ',
        120,
        320,
        'risk',
        ['retro', 'process']
      ),
      area('learned', 'Learned\n\n- ', 500, 320, 'question', [
        'retro',
        'process',
      ]),
      area(
        'try-next-sprint',
        'Try next sprint\n\n- [ ] ',
        120,
        520,
        'task',
        ['retro', 'action']
      ),
      area(
        'follow-up-owners',
        'Follow-up owners\n\n- ',
        500,
        520,
        'task',
        ['retro', 'action']
      ),
    ],
    links: [
      link('retro-context-went-well', 'sprint-context', 'went-well', 'relates-to'),
      link(
        'retro-context-needs-attention',
        'sprint-context',
        'needs-attention',
        'relates-to'
      ),
      link(
        'retro-needs-action',
        'needs-attention',
        'try-next-sprint',
        'depends-on'
      ),
      link('retro-learned-action', 'learned', 'try-next-sprint', 'implements'),
      link(
        'retro-action-owners',
        'try-next-sprint',
        'follow-up-owners',
        'depends-on'
      ),
    ],
  },
]

export const getContextKitById = (kitId: string) =>
  CONTEXT_KITS.find((kit) => kit.id === kitId) ?? null

export const insertContextKit = (
  state: PageAppState,
  kit: ContextKit,
  {
    createAreaId,
    createLinkId,
    now = new Date().toISOString(),
    offsetX = 0,
    offsetY = 0,
  }: InsertContextKitOptions
): InsertContextKitResult => {
  const idByKitAreaId = new Map<string, string>()
  const areas = kit.areas.map((kitArea, index): AreaState => {
    const id = createAreaId(index)
    idByKitAreaId.set(kitArea.id, id)

    return {
      id,
      type: 'text',
      parentId: null,
      x: kitArea.x + offsetX,
      y: kitArea.y + offsetY,
      width: kitArea.width,
      height: kitArea.height,
      text: kitArea.text,
      styles: {
        ...(index === 0 ? accentStyles : plainStyles),
        ...(kitArea.styles ?? {}),
      },
      metadata: {
        kind: kitArea.kind ?? 'note',
        ...(kitArea.status ? { status: kitArea.status } : {}),
        tags: kitArea.tags ?? [],
      },
      createdAt: now,
      updatedAt: now,
    }
  })
  const links = (kit.links ?? []).flatMap((kitLink, index): AreaLink[] => {
    const fromAreaId = idByKitAreaId.get(kitLink.fromAreaId)
    const toAreaId = idByKitAreaId.get(kitLink.toAreaId)

    if (!fromAreaId || !toAreaId) return []

    return [
      {
        id: createLinkId(index),
        fromAreaId,
        toAreaId,
        kind: kitLink.kind,
        ...(kitLink.label ? { label: kitLink.label } : {}),
        createdAt: now,
        updatedAt: now,
      },
    ]
  })

  return {
    page: state.page,
    assets: state.assets,
    areas: [...state.areas, ...areas],
    links: [...(state.links ?? []), ...links],
    selectedAreaId: areas[0]?.id ?? null,
  }
}

function area(
  id: string,
  text: string,
  x: number,
  y: number,
  kind: AreaKind = 'note',
  tags: string[] = []
): ContextKitArea {
  return {
    id,
    kind,
    tags,
    text,
    x,
    y,
    width: 300,
    height: 140,
  }
}

function link(
  id: string,
  fromAreaId: string,
  toAreaId: string,
  kind: AreaLinkKind,
  label?: string
): ContextKitLink {
  return {
    id,
    fromAreaId,
    toAreaId,
    kind,
    ...(label ? { label } : {}),
  }
}
