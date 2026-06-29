import type { AreaState, AssetState, TextAreaState } from './App'
import {
  removeAreaLinksForDeletedAreas,
  type AreaLink,
  type AreaMetadata,
} from './areaMetadata.ts'
import { reparentArea } from './nestedAreas.ts'
import type { PageAppState, PageState } from './pagePersistence'

export type AgentScope =
  | 'page:read'
  | 'page:search'
  | 'page:suggest'
  | 'page:write'

export type AgentClient = {
  id: string
  displayName: string
  scopes: AgentScope[]
}

export type AgentAreaResource = {
  id: string
  parentId: string | null
  type: 'text' | 'image'
  x: number
  y: number
  width: number
  height: number
  text?: string
  alt?: string
  assetId?: string
  metadata?: AreaMetadata
  styles: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export type AgentAssetResource = Omit<AssetState, 'storageKey'>

export type AgentPageResource = {
  schemaVersion: 1
  page: Pick<PageState, 'id' | 'title' | 'createdAt' | 'updatedAt'> & {
    settings: Omit<PageState['settings'], 'shareLinks'> & {
      shareLinks: null
    }
  }
  areas: AgentAreaResource[]
  assets: AgentAssetResource[]
  links: AreaLink[]
  permissionMode: {
    scopes: AgentScope[]
  }
}

export type AgentExtractedItem = {
  areaId: string
  kind: 'decision' | 'open-question' | 'risk'
  lineNumber: number
  text: string
}

export type AgentPatchSource = {
  kind: 'mcp-agent'
  clientId: string
  displayName: string
}

export type AgentStylePatch = Record<string, string | null>

export type AgentPatchOperation =
  | {
      op: 'createArea'
      tempId?: string
      area: {
        id?: string
        type?: 'text'
        text: string
        x: number
        y: number
        width: number
        height: number
        parentId?: string | null
        styles?: Record<string, string>
      }
    }
  | {
      op: 'updateArea'
      areaId: string
      patch: Partial<
        Pick<TextAreaState, 'text' | 'x' | 'y' | 'width' | 'height'>
      >
    }
  | {
      op: 'updateAreaStyles'
      areaId: string
      styles: AgentStylePatch
    }
  | {
      op: 'moveArea'
      areaId: string
      x: number
      y: number
    }
  | {
      op: 'deleteArea'
      areaId: string
    }
  | {
      op: 'nestArea'
      areaId: string
      parentId: string | null
    }

export type AgentPatch = {
  schemaVersion: 1
  id: string
  pageId: string
  source: AgentPatchSource
  operations: AgentPatchOperation[]
  createdAt: string
}

export type AgentPatchValidationResult =
  | {
      ok: true
    }
  | {
      ok: false
      errors: string[]
    }

export type AgentPageAuditSummary = {
  areaCount: number
  assetCount: number
  imageAreaCount: number
  textAreaCount: number
}

export type AgentActionRecord = {
  id: string
  pageId: string
  patchId: string
  clientId: string
  clientDisplayName: string
  operationCount: number
  beforeSummary: AgentPageAuditSummary
  afterSummary: AgentPageAuditSummary
  undoPatch: AgentPatch
  createdAt: string
  result: 'applied'
}

export type ApplyAgentPatchResult =
  | {
      ok: true
      state: PageAppState
      auditRecord: AgentActionRecord
    }
  | {
      ok: false
      errors: string[]
    }

export type DryRunAgentPatchResult = {
  schemaVersion: 1
  dryRun: true
  applied: false
  applyAllowed: boolean
  patch: AgentPatch
  validation: AgentPatchValidationResult
}

type CssSupportChecker = (property: string, value: string) => boolean

const MAX_AGENT_OPERATIONS = 25
const MAX_AGENT_TEXT_LENGTH = 5000
const MAX_AGENT_STYLES = 24
const MAX_AGENT_STYLE_VALUE_LENGTH = 500
const AGENT_PROPOSAL_BORDER = '1px solid #2563eb'
const AGENT_PROPOSAL_BACKGROUND = '#f8fafc'

type AgentSuggestionOptions = {
  createPatchId?: () => string
  now?: string
}

const defaultCssSupports: CssSupportChecker = (property, value) => {
  if (typeof CSS === 'undefined') return true

  return CSS.supports(property, value)
}

export const createAgentPatchId = (
  createId = createDefaultRandomId
) => `agent_patch_${createId()}`

export const createAgentActionId = (
  createId = createDefaultRandomId
) => `agent_action_${createId()}`

export const listAgentPages = (
  states: PageAppState[],
  client: AgentClient
) => ({
  schemaVersion: 1 as const,
  pages: hasScope(client, 'page:read')
    ? states.map((state) => ({
        id: state.page.id,
        title: state.page.title,
        areaCount: state.areas.length,
        assetCount: state.assets.length,
        updatedAt: state.page.updatedAt,
      }))
    : [],
})

export const getAgentPage = (
  state: PageAppState,
  client: AgentClient
): AgentPageResource => ({
  schemaVersion: 1,
  page: {
    id: state.page.id,
    title: state.page.title,
    createdAt: state.page.createdAt,
    updatedAt: state.page.updatedAt,
    settings: {
      background: state.page.settings.background,
      snapGrid: {
        ...state.page.settings.snapGrid,
      },
      theme: {
        colors: state.page.settings.theme.colors.map((color) => ({
          ...color,
        })),
      },
      mcp: {
        enabled: state.page.settings.mcp.enabled,
      },
      shareLinks: null,
    },
  },
  areas: hasScope(client, 'page:read')
    ? state.areas.map(toAgentAreaResource)
    : [],
  assets: hasScope(client, 'page:read')
    ? state.assets.map(({ storageKey, ...asset }) => {
        void storageKey

        return asset
      })
    : [],
  links: hasScope(client, 'page:read')
    ? (state.links ?? []).map((link) => ({
        ...link,
      }))
    : [],
  permissionMode: {
    scopes: [...client.scopes],
  },
})

export const searchAgentAreas = (
  state: PageAppState,
  query: string,
  client: AgentClient
) => {
  const normalizedQuery = query.trim().toLowerCase()

  return {
    schemaVersion: 1 as const,
    areas:
      normalizedQuery && hasScope(client, 'page:search')
        ? state.areas
            .filter((area) =>
              getAreaSearchText(area).includes(normalizedQuery)
            )
            .map(toAgentAreaResource)
        : [],
  }
}

export const getAgentArea = (
  state: PageAppState,
  areaId: string,
  client: AgentClient
) => ({
  schemaVersion: 1 as const,
  area: hasScope(client, 'page:read')
    ? state.areas
        .map(toAgentAreaResource)
        .find((area) => area.id === areaId) ?? null
    : null,
})

export const summarizeAgentPage = (
  state: PageAppState,
  client: AgentClient
) => {
  const areas = hasScope(client, 'page:read') ? state.areas : []
  const extractedItems = extractStructuredTextItems(areas)

  return {
    schemaVersion: 1 as const,
    page: {
      id: state.page.id,
      title: state.page.title,
    },
    summary: {
      areaCount: areas.length,
      decisionCount: extractedItems.filter(
        (item) => item.kind === 'decision'
      ).length,
      imageAreaCount: areas.filter((area) => area.type === 'image').length,
      openQuestionCount: extractedItems.filter(
        (item) => item.kind === 'open-question'
      ).length,
      riskCount: extractedItems.filter((item) => item.kind === 'risk')
        .length,
      textAreaCount: areas.filter((area) => area.type !== 'image').length,
    },
  }
}

export const extractAgentDecisions = (
  state: PageAppState,
  client: AgentClient
) => ({
  schemaVersion: 1 as const,
  items: hasScope(client, 'page:read')
    ? extractStructuredTextItems(state.areas).filter(
        (item) => item.kind === 'decision'
      )
    : [],
})

export const extractAgentOpenQuestions = (
  state: PageAppState,
  client: AgentClient
) => ({
  schemaVersion: 1 as const,
  items: hasScope(client, 'page:read')
    ? extractStructuredTextItems(state.areas).filter(
        (item) => item.kind === 'open-question'
      )
    : [],
})

export const suggestDecisionLog = (
  state: PageAppState,
  client: AgentClient,
  options: AgentSuggestionOptions = {}
): AgentPatch => {
  const decisionLines = state.areas
    .filter((area): area is TextAreaState => area.type !== 'image')
    .flatMap((area) =>
      area.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) =>
          /^(decision|open question|question|risk):/i.test(line)
        )
    )
  const text =
    decisionLines.length > 0
      ? ['Agent proposal: decision log', '', ...decisionLines].join(
          '\n'
        )
      : 'Agent proposal: decision log\n\nNo explicit decisions or open questions found yet.'
  return createAgentPatch(
    state,
    client,
    [
      {
        op: 'createArea',
        area: createSuggestionArea(state, {
          text,
          width: 420,
          height: 180,
        }),
      },
    ],
    options
  )
}

export const suggestAreas = (
  state: PageAppState,
  client: AgentClient,
  options: AgentSuggestionOptions = {}
): AgentPatch => {
  const extractedItems = extractStructuredTextItems(state.areas)
  const counts = {
    decisions: extractedItems.filter((item) => item.kind === 'decision')
      .length,
    openQuestions: extractedItems.filter(
      (item) => item.kind === 'open-question'
    ).length,
    risks: extractedItems.filter((item) => item.kind === 'risk').length,
  }
  const text = [
    'Agent proposal: Suggested areas',
    '',
    `- Decision log (${counts.decisions})`,
    `- Open questions review (${counts.openQuestions})`,
    `- Risk register (${counts.risks})`,
    '- Implementation map',
  ].join('\n')

  return createAgentPatch(
    state,
    client,
    [
      {
        op: 'createArea',
        area: createSuggestionArea(state, {
          text,
          width: 420,
          height: 180,
        }),
      },
    ],
    options
  )
}

export const suggestAreaUpdates = (
  state: PageAppState,
  client: AgentClient,
  options: AgentSuggestionOptions = {}
): AgentPatch => {
  const textAreas = state.areas.filter(
    (area): area is TextAreaState => area.type !== 'image'
  )
  const structuredAreaIds = new Set(
    extractStructuredTextItems(state.areas).map((item) => item.areaId)
  )
  const operations: AgentPatchOperation[] = textAreas
    .filter((area) => structuredAreaIds.has(area.id))
    .slice(0, MAX_AGENT_OPERATIONS)
    .map((area) => ({
      op: 'updateAreaStyles',
      areaId: area.id,
      styles: {
        background: AGENT_PROPOSAL_BACKGROUND,
      },
    }))

  if (operations.length === 0 && textAreas[0]) {
    operations.push({
      op: 'updateAreaStyles',
      areaId: textAreas[0].id,
      styles: {
        background: AGENT_PROPOSAL_BACKGROUND,
      },
    })
  }

  if (operations.length === 0) {
    operations.push({
      op: 'createArea',
      area: createSuggestionArea(state, {
        text: 'Agent proposal: area updates\n\nNo existing text Areas found yet.',
        width: 420,
        height: 140,
      }),
    })
  }

  return createAgentPatch(state, client, operations, options)
}

export const suggestBoardOrganization = (
  state: PageAppState,
  client: AgentClient,
  options: AgentSuggestionOptions = {}
): AgentPatch => {
  const organizedAreas = [...state.areas]
    .sort((first, second) => first.y - second.y || first.x - second.x)
    .slice(0, MAX_AGENT_OPERATIONS)
  const operations: AgentPatchOperation[] = organizedAreas.map(
    (area, index) => ({
      op: 'moveArea',
      areaId: area.id,
      x: 120,
      y: 120 + index * 120,
    })
  )

  if (operations.length === 0) {
    operations.push({
      op: 'createArea',
      area: createSuggestionArea(state, {
        text: 'Agent proposal: board organization\n\nNo Areas exist yet.',
        width: 420,
        height: 120,
      }),
    })
  }

  return createAgentPatch(state, client, operations, options)
}

export const suggestImplementationMap = (
  state: PageAppState,
  client: AgentClient,
  options: AgentSuggestionOptions = {}
): AgentPatch => {
  const extractedItems = extractStructuredTextItems(state.areas)
  const text = [
    'Agent proposal: Implementation map',
    '',
    'Decisions',
    ...formatExtractedItems(extractedItems, 'decision'),
    '',
    'Open questions',
    ...formatExtractedItems(extractedItems, 'open-question'),
    '',
    'Risks',
    ...formatExtractedItems(extractedItems, 'risk'),
    '',
    'Next steps',
    '- Confirm unresolved questions before implementation.',
    '- Convert accepted decisions into scoped tasks.',
  ].join('\n')

  return createAgentPatch(
    state,
    client,
    [
      {
        op: 'createArea',
        area: createSuggestionArea(state, {
          text,
          width: 480,
          height: 260,
        }),
      },
    ],
    options
  )
}

export const createAgentAreaPatch = (
  state: PageAppState,
  client: AgentClient,
  area: Extract<AgentPatchOperation, { op: 'createArea' }>['area'],
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'createArea',
        area,
      },
    ],
    options
  )

export const updateAgentAreaPatch = (
  state: PageAppState,
  client: AgentClient,
  areaId: string,
  patch: Extract<AgentPatchOperation, { op: 'updateArea' }>['patch'],
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'updateArea',
        areaId,
        patch,
      },
    ],
    options
  )

export const updateAgentAreaStylesPatch = (
  state: PageAppState,
  client: AgentClient,
  areaId: string,
  styles: AgentStylePatch,
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'updateAreaStyles',
        areaId,
        styles,
      },
    ],
    options
  )

export const moveAgentAreaPatch = (
  state: PageAppState,
  client: AgentClient,
  areaId: string,
  x: number,
  y: number,
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'moveArea',
        areaId,
        x,
        y,
      },
    ],
    options
  )

export const nestAgentAreaPatch = (
  state: PageAppState,
  client: AgentClient,
  areaId: string,
  parentId: string | null,
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'nestArea',
        areaId,
        parentId,
      },
    ],
    options
  )

export const deleteAgentAreaPatch = (
  state: PageAppState,
  client: AgentClient,
  areaId: string,
  options: AgentSuggestionOptions = {}
): AgentPatch =>
  createAgentPatch(
    state,
    client,
    [
      {
        op: 'deleteArea',
        areaId,
      },
    ],
    options
  )

export const dryRunAgentPatch = (
  state: PageAppState,
  patch: AgentPatch,
  client: AgentClient,
  {
    cssSupports = defaultCssSupports,
    mode = 'suggest',
  }: {
    cssSupports?: CssSupportChecker
    mode?: 'suggest' | 'apply'
  } = {}
): DryRunAgentPatchResult => ({
  schemaVersion: 1,
  dryRun: true,
  applied: false,
  applyAllowed: mode === 'apply' && hasScope(client, 'page:write'),
  patch,
  validation: validateAgentPatch(state, patch, client, {
    cssSupports,
    mode,
  }),
})

const createAgentPatch = (
  state: PageAppState,
  client: AgentClient,
  operations: AgentPatchOperation[],
  {
    createPatchId: createPatchIdOverride = createAgentPatchId,
    now = new Date().toISOString(),
  }: AgentSuggestionOptions = {}
): AgentPatch => {
  const patchId = createPatchIdOverride()

  return {
    schemaVersion: 1,
    id: patchId,
    pageId: state.page.id,
    source: {
      kind: 'mcp-agent',
      clientId: client.id,
      displayName: client.displayName,
    },
    operations: operations.map((operation, index) =>
      operation.op === 'createArea' && !operation.tempId
        ? {
            ...operation,
            tempId: `${patchId}_area_${index + 1}`,
          }
        : operation
    ),
    createdAt: now,
  }
}

export const createAgentPatchForOperation = (
  patch: AgentPatch,
  operationIndex: number
): AgentPatch | null => {
  const operation = patch.operations[operationIndex]

  if (!operation) return null

  return {
    ...patch,
    id: `${patch.id}_operation_${operationIndex + 1}`,
    operations: [operation],
  }
}

export const removeAgentPatchOperation = (
  patch: AgentPatch,
  operationIndex: number
): AgentPatch | null => {
  if (!patch.operations[operationIndex]) return patch

  const operations = patch.operations.filter(
    (_operation, index) => index !== operationIndex
  )

  if (operations.length === 0) return null

  return {
    ...patch,
    operations,
  }
}

const createSuggestionArea = (
  state: PageAppState,
  {
    text,
    width,
    height,
  }: {
    text: string
    width: number
    height: number
  }
): Extract<AgentPatchOperation, { op: 'createArea' }>['area'] => ({
  type: 'text',
  text,
  x: 120,
  y: getCanvasBottomY(state) + 80,
  width,
  height,
  styles: {
    border: AGENT_PROPOSAL_BORDER,
  },
})

const formatExtractedItems = (
  items: AgentExtractedItem[],
  kind: AgentExtractedItem['kind']
) => {
  const matchingItems = items.filter((item) => item.kind === kind)

  return matchingItems.length > 0
    ? matchingItems.map((item) => `- ${item.text}`)
    : ['- None found yet.']
}

const getCanvasBottomY = (state: PageAppState) =>
  state.areas.reduce(
    (currentMax, area) => Math.max(currentMax, area.y + area.height),
    80
  )

export const validateAgentPatch = (
  state: PageAppState,
  patch: AgentPatch,
  client: AgentClient,
  {
    cssSupports = defaultCssSupports,
    mode = 'suggest',
  }: {
    cssSupports?: CssSupportChecker
    mode?: 'suggest' | 'apply'
  } = {}
): AgentPatchValidationResult => {
  const errors: string[] = []

  if (mode === 'apply' && !hasScope(client, 'page:write')) {
    errors.push('Agent client requires page:write scope to apply patches.')
  }

  if (mode === 'suggest' && !hasScope(client, 'page:suggest')) {
    errors.push(
      'Agent client requires page:suggest scope to propose patches.'
    )
  }

  if (!isRecord(patch)) {
    return {
      ok: false,
      errors: ['Patch must be an object.'],
    }
  }

  if (patch.schemaVersion !== 1) {
    errors.push('Patch schemaVersion must be 1.')
  }

  if (patch.pageId !== state.page.id) {
    errors.push('Patch pageId does not match the current page.')
  }

  if (!Array.isArray(patch.operations)) {
    errors.push('Patch operations must be an array.')
  } else if (
    patch.operations.length === 0 ||
    patch.operations.length > MAX_AGENT_OPERATIONS
  ) {
    errors.push(
      `Patch must include 1-${MAX_AGENT_OPERATIONS} operations.`
    )
  } else {
    patch.operations.forEach((operation, index) => {
      validateAgentOperation(
        state,
        operation,
        index,
        cssSupports,
        errors
      )
    })
  }

  return errors.length > 0
    ? {
        ok: false,
        errors,
      }
    : {
        ok: true,
      }
}

export const applyAgentPatch = (
  state: PageAppState,
  patch: AgentPatch,
  client: AgentClient,
  {
    createActionId = createAgentActionId,
    cssSupports = defaultCssSupports,
    now = new Date().toISOString(),
  }: {
    createActionId?: () => string
    cssSupports?: CssSupportChecker
    now?: string
  } = {}
): ApplyAgentPatchResult => {
  const validation = validateAgentPatch(state, patch, client, {
    cssSupports,
    mode: 'apply',
  })

  if (!validation.ok) return validation

  const nextState = patch.operations.reduce(
    applyAgentOperation,
    clonePageAppState(state)
  )
  const beforeSummary = createAgentPageAuditSummary(state)
  const afterSummary = createAgentPageAuditSummary(nextState)
  const undoPatch = createAgentUndoPatch(state, patch, client, now)

  return {
    ok: true,
    state: nextState,
    auditRecord: {
      id: createActionId(),
      pageId: patch.pageId,
      patchId: patch.id,
      clientId: client.id,
      clientDisplayName: client.displayName,
      operationCount: patch.operations.length,
      beforeSummary,
      afterSummary,
      undoPatch,
      createdAt: now,
      result: 'applied',
    },
  }
}

const createAgentPageAuditSummary = (
  state: PageAppState
): AgentPageAuditSummary => ({
  areaCount: state.areas.length,
  assetCount: state.assets.length,
  imageAreaCount: state.areas.filter((area) => area.type === 'image')
    .length,
  textAreaCount: state.areas.filter((area) => area.type !== 'image')
    .length,
})

const createAgentUndoPatch = (
  state: PageAppState,
  patch: AgentPatch,
  client: AgentClient,
  now: string
): AgentPatch => {
  let currentState = clonePageAppState(state)
  const createdAreaIds = new Set(
    patch.operations.flatMap((operation, index) =>
      operation.op === 'createArea'
        ? [getCreatedAgentAreaId(operation, index)]
        : []
    )
  )
  const deletedAreaIds = patch.operations.flatMap((operation) =>
    operation.op === 'deleteArea' ? [operation.areaId] : []
  )
  const deletedAreaIdSet = new Set(deletedAreaIds)
  const undoOperations: AgentPatchOperation[] = []

  patch.operations.forEach((operation, index) => {
    const undoOperation = createAgentUndoOperation(
      currentState,
      operation,
      index,
      deletedAreaIdSet
    )

    if (undoOperation) {
      undoOperations.push(undoOperation)
    }

    currentState = applyAgentOperation(currentState, operation, index)
  })

  return {
    schemaVersion: 1,
    id: `${patch.id}_undo`,
    pageId: patch.pageId,
    source: {
      kind: 'mcp-agent',
      clientId: client.id,
      displayName: `${client.displayName} undo`,
    },
    operations: [
      ...deletedAreaIds.flatMap((areaId) =>
        createdAreaIds.has(areaId)
          ? []
          : createAgentRestoreTextAreaOperation(state, areaId)
      ),
      ...undoOperations.reverse(),
    ],
    createdAt: now,
  }
}

const createAgentUndoOperation = (
  state: PageAppState,
  operation: AgentPatchOperation,
  index: number,
  deletedAreaIds: Set<string>
): AgentPatchOperation | null => {
  if (operation.op === 'createArea') {
    const areaId = getCreatedAgentAreaId(operation, index)

    if (deletedAreaIds.has(areaId)) return null

    return {
      op: 'deleteArea',
      areaId,
    }
  }

  if ('areaId' in operation && deletedAreaIds.has(operation.areaId)) {
    return null
  }

  if (operation.op === 'updateArea') {
    const area = state.areas.find(
      (candidate): candidate is TextAreaState =>
        candidate.id === operation.areaId && candidate.type !== 'image'
    )

    if (!area) return null

    const patch: Extract<
      AgentPatchOperation,
      { op: 'updateArea' }
    >['patch'] = {}

    if (operation.patch.text !== undefined) patch.text = area.text
    if (operation.patch.x !== undefined) patch.x = area.x
    if (operation.patch.y !== undefined) patch.y = area.y
    if (operation.patch.width !== undefined) patch.width = area.width
    if (operation.patch.height !== undefined) patch.height = area.height

    if (Object.keys(patch).length === 0) return null

    return {
      op: 'updateArea',
      areaId: operation.areaId,
      patch,
    }
  }

  if (operation.op === 'updateAreaStyles') {
    const area = state.areas.find(
      (candidate) => candidate.id === operation.areaId
    )

    if (!area) return null

    const styles: AgentStylePatch = {}

    for (const property of Object.keys(operation.styles)) {
      styles[property] = Object.hasOwn(area.styles, property)
        ? area.styles[property]
        : null
    }

    if (Object.keys(styles).length === 0) return null

    return {
      op: 'updateAreaStyles',
      areaId: operation.areaId,
      styles,
    }
  }

  if (operation.op === 'moveArea') {
    const area = state.areas.find(
      (candidate) => candidate.id === operation.areaId
    )

    if (!area) return null

    return {
      op: 'moveArea',
      areaId: operation.areaId,
      x: area.x,
      y: area.y,
    }
  }

  if (operation.op === 'nestArea') {
    const area = state.areas.find(
      (candidate) => candidate.id === operation.areaId
    )

    if (!area) return null

    return {
      op: 'nestArea',
      areaId: operation.areaId,
      parentId: area.parentId,
    }
  }

  const area = state.areas.find(
    (candidate): candidate is TextAreaState =>
      candidate.id === operation.areaId && candidate.type !== 'image'
  )

  if (!area) return null

  return {
    op: 'createArea',
    area: {
      id: area.id,
      type: 'text',
      text: area.text,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      parentId: area.parentId,
      styles: {
        ...area.styles,
      },
    },
  }
}

const getCreatedAgentAreaId = (
  operation: Extract<AgentPatchOperation, { op: 'createArea' }>,
  index: number
) => operation.area.id ?? operation.tempId ?? `agent_area_${index + 1}`

const createAgentRestoreTextAreaOperation = (
  state: PageAppState,
  areaId: string
): AgentPatchOperation[] => {
  const area = state.areas.find(
    (candidate): candidate is TextAreaState =>
      candidate.id === areaId && candidate.type !== 'image'
  )

  if (!area) return []

  return [
    {
      op: 'createArea',
      area: {
        id: area.id,
        type: 'text',
        text: area.text,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        parentId: area.parentId,
        styles: {
          ...area.styles,
        },
      },
    },
  ]
}

const validateAgentOperation = (
  state: PageAppState,
  operation: AgentPatchOperation,
  index: number,
  cssSupports: CssSupportChecker,
  errors: string[]
) => {
  if (!isRecord(operation) || typeof operation.op !== 'string') {
    errors.push(`Operation ${index + 1} is malformed.`)
    return
  }

  if (operation.op === 'createArea') {
    validateCreateAreaOperation(operation, index, cssSupports, errors)
    return
  }

  if (operation.op === 'updateArea') {
    if (!hasArea(state, operation.areaId)) {
      errors.push(`Operation ${index + 1} references an unknown Area.`)
    }

    if (
      typeof operation.patch.text === 'string' &&
      operation.patch.text.length > MAX_AGENT_TEXT_LENGTH
    ) {
      errors.push(`Operation ${index + 1} text is too large.`)
    }

    return
  }

  if (operation.op === 'updateAreaStyles') {
    if (!hasArea(state, operation.areaId)) {
      errors.push(`Operation ${index + 1} references an unknown Area.`)
    }

    validateStyles(operation.styles, index, cssSupports, errors)
    return
  }

  if (operation.op === 'moveArea') {
    if (!hasArea(state, operation.areaId)) {
      errors.push(`Operation ${index + 1} references an unknown Area.`)
    }

    if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) {
      errors.push(`Operation ${index + 1} has invalid coordinates.`)
    }

    return
  }

  if (operation.op === 'deleteArea') {
    if (!hasArea(state, operation.areaId)) {
      errors.push(`Operation ${index + 1} references an unknown Area.`)
    }

    return
  }

  if (operation.op === 'nestArea') {
    validateNestAreaOperation(state, operation, index, errors)
    return
  }

  errors.push(`Operation ${index + 1} has an unsupported op.`)
}

const validateCreateAreaOperation = (
  operation: Extract<AgentPatchOperation, { op: 'createArea' }>,
  index: number,
  cssSupports: CssSupportChecker,
  errors: string[]
) => {
  if (!isRecord(operation.area)) {
    errors.push(`Operation ${index + 1} area must be an object.`)
    return
  }

  if (
    typeof operation.area.text !== 'string' ||
    operation.area.text.length > MAX_AGENT_TEXT_LENGTH
  ) {
    errors.push(`Operation ${index + 1} text is invalid or too large.`)
  }

  if (
    !Number.isFinite(operation.area.x) ||
    !Number.isFinite(operation.area.y) ||
    !Number.isFinite(operation.area.width) ||
    !Number.isFinite(operation.area.height) ||
    operation.area.width <= 0 ||
    operation.area.height <= 0
  ) {
    errors.push(`Operation ${index + 1} has invalid geometry.`)
  }

  validateStyles(
    operation.area.styles ?? {},
    index,
    cssSupports,
    errors,
    {
      allowRemoval: false,
    }
  )
}

const validateStyles = (
  styles: AgentStylePatch,
  index: number,
  cssSupports: CssSupportChecker,
  errors: string[],
  {
    allowRemoval = true,
  }: {
    allowRemoval?: boolean
  } = {}
) => {
  if (!isRecord(styles)) {
    errors.push(`Operation ${index + 1} styles must be an object.`)
    return
  }

  const entries = Object.entries(styles)

  if (entries.length > MAX_AGENT_STYLES) {
    errors.push(`Operation ${index + 1} has too many styles.`)
  }

  for (const [property, value] of entries) {
    if (value === null && allowRemoval) continue

    if (
      typeof value !== 'string' ||
      value.length > MAX_AGENT_STYLE_VALUE_LENGTH ||
      !cssSupports(property, value)
    ) {
      errors.push(
        `Operation ${index + 1} has invalid CSS for ${property}.`
      )
    }
  }
}

const validateNestAreaOperation = (
  state: PageAppState,
  operation: Extract<AgentPatchOperation, { op: 'nestArea' }>,
  index: number,
  errors: string[]
) => {
  if (!hasArea(state, operation.areaId)) {
    errors.push(`Operation ${index + 1} references an unknown Area.`)
    return
  }

  if (
    operation.parentId !== null &&
    typeof operation.parentId !== 'string'
  ) {
    errors.push(`Operation ${index + 1} has an invalid parent Area.`)
    return
  }

  if (operation.parentId === operation.areaId) {
    errors.push(`Operation ${index + 1} cannot nest an Area inside itself.`)
    return
  }

  if (operation.parentId && !hasArea(state, operation.parentId)) {
    errors.push(`Operation ${index + 1} references an unknown parent Area.`)
    return
  }

  if (
    operation.parentId &&
    reparentArea(state.areas, operation.areaId, operation.parentId) ===
      state.areas
  ) {
    errors.push(`Operation ${index + 1} violates Area nesting rules.`)
  }
}

const applyAgentOperation = (
  state: PageAppState,
  operation: AgentPatchOperation,
  index: number
): PageAppState => {
  if (operation.op === 'createArea') {
    const now = new Date().toISOString()
    const area: TextAreaState = {
      id:
        operation.area.id ??
        operation.tempId ??
        `agent_area_${index + 1}`,
      type: 'text',
      parentId: operation.area.parentId ?? null,
      x: operation.area.x,
      y: operation.area.y,
      width: operation.area.width,
      height: operation.area.height,
      text: operation.area.text,
      styles: {
        ...(operation.area.styles ?? {}),
      },
      createdAt: now,
      updatedAt: now,
    }

    return {
      ...state,
      areas: [...state.areas, area],
    }
  }

  if (operation.op === 'updateArea') {
    return {
      ...state,
      areas: state.areas.map((area) =>
        area.id === operation.areaId && area.type !== 'image'
          ? {
              ...area,
              ...operation.patch,
            }
          : area
      ),
    }
  }

  if (operation.op === 'updateAreaStyles') {
    return {
      ...state,
      areas: state.areas.map((area) => {
        if (area.id !== operation.areaId) return area

        const styles = {
          ...area.styles,
        }

        for (const [property, value] of Object.entries(
          operation.styles
        )) {
          if (value === null) {
            delete styles[property]
          } else {
            styles[property] = value
          }
        }

        return {
          ...area,
          styles,
        }
      }),
    }
  }

  if (operation.op === 'moveArea') {
    return {
      ...state,
      areas: state.areas.map((area) =>
        area.id === operation.areaId
          ? {
              ...area,
              x: operation.x,
              y: operation.y,
            }
          : area
      ),
    }
  }

  if (operation.op === 'nestArea') {
    return {
      ...state,
      areas: reparentArea(state.areas, operation.areaId, operation.parentId),
    }
  }

  return {
    ...state,
    areas: state.areas.filter((area) => area.id !== operation.areaId),
    links: removeAreaLinksForDeletedAreas(
      state.links ?? [],
      new Set([operation.areaId])
    ),
  }
}

const toAgentAreaResource = (area: AreaState): AgentAreaResource => {
  const metadata = area.metadata
    ? {
        metadata: {
          ...area.metadata,
          tags: [...area.metadata.tags],
        },
      }
    : {}

  if (area.type === 'image') {
    return {
      id: area.id,
      parentId: area.parentId,
      type: 'image',
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      alt: area.alt,
      assetId: area.assetId,
      styles: {
        ...area.styles,
      },
      ...metadata,
      createdAt: area.createdAt,
      updatedAt: area.updatedAt,
    }
  }

  return {
    id: area.id,
    parentId: area.parentId,
    type: 'text',
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    text: area.text,
    styles: {
      ...area.styles,
    },
    ...metadata,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  }
}

const getAreaSearchText = (area: AreaState) => {
  if (area.type === 'image') {
    return `${area.id} ${area.alt}`.toLowerCase()
  }

  return `${area.id} ${area.text}`.toLowerCase()
}

const extractStructuredTextItems = (areas: AreaState[]) =>
  areas.flatMap((area) => {
    if (area.type === 'image') return []

    return area.text
      .split('\n')
      .map((line, lineIndex) =>
        getStructuredTextItem(area.id, line, lineIndex + 1)
      )
      .filter((item): item is AgentExtractedItem => item !== null)
  })

const getStructuredTextItem = (
  areaId: string,
  line: string,
  lineNumber: number
): AgentExtractedItem | null => {
  const trimmedLine = line.trim()
  const match = /^(decision|open question|question|risk)\s*:\s*(.+)$/i.exec(
    trimmedLine
  )

  if (!match) return null

  const rawKind = match[1].toLowerCase()
  const kind =
    rawKind === 'decision'
      ? 'decision'
      : rawKind === 'risk'
        ? 'risk'
        : 'open-question'

  return {
    areaId,
    kind,
    lineNumber,
    text: match[2].trim(),
  }
}

const hasScope = (client: AgentClient, scope: AgentScope) =>
  client.scopes.includes(scope)

const hasArea = (state: PageAppState, areaId: string) =>
  state.areas.some((area) => area.id === areaId)

const clonePageAppState = (state: PageAppState): PageAppState => ({
  page: {
    ...state.page,
    settings: {
      ...state.page.settings,
      snapGrid: {
        ...state.page.settings.snapGrid,
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
  },
  areas: state.areas.map((area) => ({
    ...area,
    styles: {
      ...area.styles,
    },
    ...(area.metadata
      ? {
          metadata: {
            ...area.metadata,
            tags: [...area.metadata.tags],
          },
        }
      : {}),
  })),
  assets: state.assets.map((asset) => ({
    ...asset,
  })),
  links: (state.links ?? []).map((link) => ({
    ...link,
  })),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const createDefaultRandomId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}`
}
