import type { AgentActionRecord, AgentPatch } from './agentInterface'
import type { PageAppState } from './pagePersistence'

export const PAGE_HISTORY_SCHEMA_VERSION = 1
export const PAGE_HISTORY_STORAGE_KEY = 'tool.pageHistory.v1'

const MAX_HISTORY_EVENTS = 30

export type ChangeActor = {
  kind: 'local-user' | 'remote-user' | 'mcp-agent' | 'system'
  id: string
  displayName: string
}

export type PageChangeActionType =
  | 'agent-proposal'
  | 'import'
  | 'restore'
  | 'page-change'

export type PageChangeEvent = {
  id: string
  pageId: string
  actor: ChangeActor
  summary: string
  actionType: PageChangeActionType
  operationCount: number
  createdAt: string
  reversible: boolean
  undoPatchId?: string
  sourceId?: string
}

export type RestorePageStatePatch = {
  id: string
  kind: 'restore-page-state'
  pageId: string
  label: string
  state: PageAppState
  createdAt: string
}

export type AgentUndoPatch = {
  id: string
  kind: 'agent-patch'
  pageId: string
  label: string
  patch: AgentPatch
  createdAt: string
}

export type PageHistoryPatch = RestorePageStatePatch | AgentUndoPatch

export type PageHistoryEntry = {
  event: PageChangeEvent
  patch: PageHistoryPatch
}

export type PageHistoryState = {
  schemaVersion: 1
  events: PageChangeEvent[]
  patches: Record<string, PageHistoryPatch>
}

export const createEmptyPageHistoryState = (): PageHistoryState => ({
  schemaVersion: PAGE_HISTORY_SCHEMA_VERSION,
  events: [],
  patches: {},
})

export const createImportHistoryEntry = ({
  actor,
  beforeState,
  createId = createHistoryId,
  importedAreaCount,
  now = new Date().toISOString(),
  pageId = beforeState.page.id,
}: {
  actor: ChangeActor
  beforeState: PageAppState
  createId?: () => string
  importedAreaCount: number
  now?: string
  pageId?: string
}): PageHistoryEntry => {
  const id = createId()
  const patchId = `patch-${id}`

  return {
    event: {
      id: `change-${id}`,
      pageId,
      actor,
      summary: 'Imported page JSON',
      actionType: 'import',
      operationCount: Math.max(1, importedAreaCount),
      createdAt: now,
      reversible: true,
      undoPatchId: patchId,
    },
    patch: {
      id: patchId,
      kind: 'restore-page-state',
      pageId,
      label: 'Restore previous page',
      state: sanitizePageStateForHistory(beforeState),
      createdAt: now,
    },
  }
}

export const createAgentHistoryEntry = (
  auditRecord: AgentActionRecord
): PageHistoryEntry => {
  const patchId = `patch-${auditRecord.id}`

  return {
    event: {
      id: `change-${auditRecord.id}`,
      pageId: auditRecord.pageId,
      actor: {
        kind: 'mcp-agent',
        id: auditRecord.clientId,
        displayName: auditRecord.clientDisplayName,
      },
      summary: `Applied agent proposal ${auditRecord.patchId}`,
      actionType: 'agent-proposal',
      operationCount: auditRecord.operationCount,
      createdAt: auditRecord.createdAt,
      reversible: true,
      undoPatchId: patchId,
      sourceId: auditRecord.patchId,
    },
    patch: {
      id: patchId,
      kind: 'agent-patch',
      pageId: auditRecord.pageId,
      label: 'Undo patch',
      patch: auditRecord.undoPatch,
      createdAt: auditRecord.createdAt,
    },
  }
}

export const addPageHistoryEntry = (
  history: PageHistoryState,
  entry: PageHistoryEntry,
  limit = MAX_HISTORY_EVENTS
): PageHistoryState => {
  const events = [
    entry.event,
    ...history.events.filter((event) => event.id !== entry.event.id),
  ].slice(0, limit)
  const referencedPatchIds = new Set(
    events
      .map((event) => event.undoPatchId)
      .filter((patchId): patchId is string => Boolean(patchId))
  )
  const patches: Record<string, PageHistoryPatch> = {
    ...history.patches,
    [entry.patch.id]: entry.patch,
  }

  for (const patchId of Object.keys(patches)) {
    if (!referencedPatchIds.has(patchId)) {
      delete patches[patchId]
    }
  }

  return {
    schemaVersion: PAGE_HISTORY_SCHEMA_VERSION,
    events,
    patches,
  }
}

export const getRecentPageHistoryEvents = (
  history: PageHistoryState,
  pageId: string,
  limit = MAX_HISTORY_EVENTS
) =>
  history.events
    .filter((event) => event.pageId === pageId)
    .sort(
      (first, second) =>
        Date.parse(second.createdAt) - Date.parse(first.createdAt)
    )
    .slice(0, limit)

export const getPageHistoryPatch = (
  history: PageHistoryState,
  patchId: string
) => history.patches[patchId] ?? null

export const applyRestorePageStatePatch = (
  _currentState: PageAppState,
  patch: RestorePageStatePatch
): PageAppState => clonePageState(patch.state)

export const serializePageHistoryState = (history: PageHistoryState) =>
  `${JSON.stringify(history, null, 2)}\n`

export const parsePageHistoryJson = (json: string): PageHistoryState => {
  try {
    const value = JSON.parse(json)

    if (!isRecord(value)) return createEmptyPageHistoryState()
    if (value.schemaVersion !== PAGE_HISTORY_SCHEMA_VERSION) {
      return createEmptyPageHistoryState()
    }
    if (!Array.isArray(value.events) || !isRecord(value.patches)) {
      return createEmptyPageHistoryState()
    }

    return {
      schemaVersion: PAGE_HISTORY_SCHEMA_VERSION,
      events: value.events.filter(isPageChangeEvent),
      patches: Object.fromEntries(
        Object.entries(value.patches).filter(
          (entry): entry is [string, PageHistoryPatch] =>
            typeof entry[0] === 'string' &&
            isPageHistoryPatch(entry[1])
        )
      ),
    }
  } catch {
    return createEmptyPageHistoryState()
  }
}

const createHistoryId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `history_${crypto.randomUUID()}`
  }

  return `history_${Date.now()}`
}

const sanitizePageStateForHistory = (state: PageAppState) => ({
  ...clonePageState(state),
  page: {
    ...state.page,
    settings: {
      ...state.page.settings,
      shareLinks: null,
    },
  },
})

const clonePageState = (state: PageAppState): PageAppState => ({
  page: {
    ...state.page,
    settings: {
      background: state.page.settings.background,
      mcp: {
        ...state.page.settings.mcp,
      },
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
  areas: state.areas.map((area) =>
    area.type === 'image'
      ? {
          ...area,
          styles: {
            ...area.styles,
          },
        }
      : {
          ...area,
          styles: {
            ...area.styles,
          },
        }
  ),
  assets: state.assets.map((asset) => ({
    ...asset,
  })),
})

const isPageChangeEvent = (value: unknown): value is PageChangeEvent => {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.pageId === 'string' &&
    isChangeActor(value.actor) &&
    typeof value.summary === 'string' &&
    isPageChangeActionType(value.actionType) &&
    typeof value.operationCount === 'number' &&
    Number.isFinite(value.operationCount) &&
    typeof value.createdAt === 'string' &&
    typeof value.reversible === 'boolean' &&
    (value.undoPatchId === undefined ||
      typeof value.undoPatchId === 'string') &&
    (value.sourceId === undefined || typeof value.sourceId === 'string')
  )
}

const isChangeActor = (value: unknown): value is ChangeActor => {
  if (!isRecord(value)) return false

  return (
    (value.kind === 'local-user' ||
      value.kind === 'remote-user' ||
      value.kind === 'mcp-agent' ||
      value.kind === 'system') &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string'
  )
}

const isPageChangeActionType = (
  value: unknown
): value is PageChangeActionType =>
  value === 'agent-proposal' ||
  value === 'import' ||
  value === 'restore' ||
  value === 'page-change'

const isPageHistoryPatch = (
  value: unknown
): value is PageHistoryPatch => {
  if (!isRecord(value)) return false

  if (value.kind === 'restore-page-state') {
    return (
      typeof value.id === 'string' &&
      typeof value.pageId === 'string' &&
      typeof value.label === 'string' &&
      typeof value.createdAt === 'string' &&
      isRecord(value.state)
    )
  }

  if (value.kind === 'agent-patch') {
    return (
      typeof value.id === 'string' &&
      typeof value.pageId === 'string' &&
      typeof value.label === 'string' &&
      typeof value.createdAt === 'string' &&
      isRecord(value.patch)
    )
  }

  return false
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
