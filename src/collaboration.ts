import type { AreaState } from './App'
import { removeAreaLinksForDeletedAreas } from './areaMetadata.ts'
import type { PageAppState, PageSettings } from './pagePersistence'
import type { ShareAccessMode } from './shareLinks'

export const COLLABORATION_PROFILE_COOKIE =
  'tool.collaborationProfile'
export const COLLABORATION_CHANNEL_PREFIX = 'tool.collaboration'
export const PRESENCE_STALE_MS = 15_000

export type CollaborationProfile = {
  clientId: string
  userName: string
  color: string
}

export type PresenceState = CollaborationProfile & {
  cursor: {
    x: number
    y: number
  } | null
  selectedAreaId: string | null
  lastSeenAt: number
}

export type AreaOperationPatch = Partial<
  Omit<AreaState, 'styles'>
> & {
  styles?: Record<string, string>
}

export type PageSettingsOperationPatch = Partial<
  Omit<PageSettings, 'snapGrid' | 'theme'>
> & {
  snapGrid?: Partial<PageSettings['snapGrid']>
  theme?: Partial<PageSettings['theme']>
}

export type PageOperation =
  | {
      type: 'area:create'
      area: AreaState
    }
  | {
      type: 'area:update'
      id: string
      patch: AreaOperationPatch
    }
  | {
      type: 'area:delete'
      id: string
    }
  | {
      type: 'page-settings:update'
      patch: PageSettingsOperationPatch
    }

const PROFILE_NAMES = [
  'Canvas Pilot',
  'Layout Maker',
  'Grid Shaper',
  'Style Builder',
  'Page Weaver',
  'Frame Guide',
]

const PROFILE_COLORS = [
  '#2563eb',
  '#059669',
  '#dc2626',
  '#7c3aed',
  '#c2410c',
  '#0f766e',
]

export const getCollaborationChannelName = (pageId: string) =>
  `${COLLABORATION_CHANNEL_PREFIX}.${pageId}`

export const createCollaborationProfile = (
  createClientId = createDefaultClientId
): CollaborationProfile => {
  const clientId = createClientId()
  const hash = hashString(clientId)

  return {
    clientId,
    userName: PROFILE_NAMES[hash % PROFILE_NAMES.length],
    color: PROFILE_COLORS[hash % PROFILE_COLORS.length],
  }
}

export const getCollaborationProfileFromCookie = (
  cookieString: string
): CollaborationProfile | null => {
  const cookie = cookieString
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) =>
      entry.startsWith(`${COLLABORATION_PROFILE_COOKIE}=`)
    )

  if (!cookie) return null

  try {
    const [, encodedValue] = cookie.split('=')
    const value = JSON.parse(decodeURIComponent(encodedValue))

    return isCollaborationProfile(value) ? value : null
  } catch {
    return null
  }
}

export const serializeCollaborationProfileCookie = (
  profile: CollaborationProfile
) =>
  `${COLLABORATION_PROFILE_COOKIE}=${encodeURIComponent(
    JSON.stringify(profile)
  )}; Path=/; Max-Age=31536000; SameSite=Lax`

export const applyPageOperation = (
  state: PageAppState,
  operation: PageOperation
): PageAppState => {
  if (operation.type === 'area:create') {
    if (state.areas.some((area) => area.id === operation.area.id)) {
      return state
    }

    return {
      ...state,
      areas: [...state.areas, cloneArea(operation.area)],
    }
  }

  if (operation.type === 'area:update') {
    return {
      ...state,
      areas: state.areas.map((area) =>
        area.id === operation.id
          ? mergeAreaPatch(area, operation.patch)
          : area
      ),
    }
  }

  if (operation.type === 'area:delete') {
    const deletedAreaIds = getAreaAndDescendantIds(
      state.areas,
      operation.id
    )

    return {
      ...state,
      areas: state.areas.filter(
        (area) => !deletedAreaIds.has(area.id)
      ),
      links: removeAreaLinksForDeletedAreas(
        state.links ?? [],
        deletedAreaIds
      ),
    }
  }

  return {
    ...state,
    page: {
      ...state.page,
      settings: mergePageSettings(
        state.page.settings,
        operation.patch
      ),
    },
  }
}

export const canPublishCollaborationOperation = (
  accessMode: ShareAccessMode,
  operation: PageOperation
) => {
  void operation

  return accessMode === 'edit'
}

export const createPresenceState = (
  profile: CollaborationProfile,
  state: Pick<PresenceState, 'cursor' | 'selectedAreaId'>,
  lastSeenAt = Date.now()
): PresenceState => ({
  ...profile,
  cursor: state.cursor,
  selectedAreaId: state.selectedAreaId,
  lastSeenAt,
})

export const pruneStalePresences = (
  presences: PresenceState[],
  now = Date.now(),
  staleAfterMs = PRESENCE_STALE_MS
) =>
  presences.filter(
    (presence) => now - presence.lastSeenAt <= staleAfterMs
  )

export const upsertPresence = (
  presences: PresenceState[],
  presence: PresenceState,
  localClientId: string
) => {
  if (presence.clientId === localClientId) return presences

  const nextPresences = presences.filter(
    (currentPresence) =>
      currentPresence.clientId !== presence.clientId
  )

  return [...nextPresences, presence]
}

const createDefaultClientId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `client_${crypto.randomUUID()}`
  }

  return `client_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`
}

const isCollaborationProfile = (
  value: unknown
): value is CollaborationProfile =>
  typeof value === 'object' &&
  value !== null &&
  'clientId' in value &&
  'userName' in value &&
  'color' in value &&
  typeof value.clientId === 'string' &&
  typeof value.userName === 'string' &&
  typeof value.color === 'string'

const hashString = (value: string) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

const mergeAreaPatch = (
  area: AreaState,
  patch: AreaOperationPatch
): AreaState => {
  const { styles, ...restPatch } = patch

  return {
    ...area,
    ...restPatch,
    styles: styles
      ? {
          ...area.styles,
          ...styles,
        }
      : area.styles,
  } as AreaState
}

const mergePageSettings = (
  settings: PageSettings,
  patch: PageSettingsOperationPatch
): PageSettings => ({
  ...settings,
  ...patch,
  snapGrid: patch.snapGrid
    ? {
        ...settings.snapGrid,
        ...patch.snapGrid,
      }
    : settings.snapGrid,
  theme: patch.theme
    ? {
        ...settings.theme,
        ...patch.theme,
      }
    : settings.theme,
})

const cloneArea = (area: AreaState): AreaState => ({
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
})

const getAreaAndDescendantIds = (
  areas: AreaState[],
  areaId: string
) => {
  const areaIds = new Set([areaId])
  const pendingAreaIds = [areaId]

  while (pendingAreaIds.length > 0) {
    const parentId = pendingAreaIds.pop()

    for (const area of areas) {
      if (
        parentId &&
        area.parentId === parentId &&
        !areaIds.has(area.id)
      ) {
        areaIds.add(area.id)
        pendingAreaIds.push(area.id)
      }
    }
  }

  return areaIds
}
