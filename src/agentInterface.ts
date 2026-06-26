import type { AreaState, AssetState, TextAreaState } from './App'
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
  permissionMode: {
    scopes: AgentScope[]
  }
}

export type AgentPatchSource = {
  kind: 'mcp-agent'
  clientId: string
  displayName: string
}

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
      styles: Record<string, string>
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

export type AgentActionRecord = {
  id: string
  pageId: string
  patchId: string
  clientId: string
  clientDisplayName: string
  operationCount: number
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

type CssSupportChecker = (property: string, value: string) => boolean

const MAX_AGENT_OPERATIONS = 25
const MAX_AGENT_TEXT_LENGTH = 5000
const MAX_AGENT_STYLES = 24
const MAX_AGENT_STYLE_VALUE_LENGTH = 500

const defaultCssSupports: CssSupportChecker = (property, value) => {
  if (typeof CSS === 'undefined') return false

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

export const suggestDecisionLog = (
  state: PageAppState,
  client: AgentClient,
  {
    createPatchId: createPatchIdOverride = createAgentPatchId,
    now = new Date().toISOString(),
  }: {
    createPatchId?: () => string
    now?: string
  } = {}
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
  const maxY = state.areas.reduce(
    (currentMax, area) => Math.max(currentMax, area.y + area.height),
    80
  )
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
    operations: [
      {
        op: 'createArea',
        tempId: `${patchId}_decision_log`,
        area: {
          type: 'text',
          text,
          x: 120,
          y: maxY + 80,
          width: 420,
          height: 180,
          styles: {
            border: '1px solid #2563eb',
          },
        },
      },
    ],
    createdAt: now,
  }
}

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
      createdAt: now,
      result: 'applied',
    },
  }
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
    errors
  )
}

const validateStyles = (
  styles: Record<string, string>,
  index: number,
  cssSupports: CssSupportChecker,
  errors: string[]
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
      areas: state.areas.map((area) =>
        area.id === operation.areaId
          ? {
              ...area,
              styles: {
                ...area.styles,
                ...operation.styles,
              },
            }
          : area
      ),
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

  return {
    ...state,
    areas: state.areas.filter((area) => area.id !== operation.areaId),
  }
}

const toAgentAreaResource = (area: AreaState): AgentAreaResource => {
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
  })),
  assets: state.assets.map((asset) => ({
    ...asset,
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
