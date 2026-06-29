import { useCallback, useEffect, useRef, useState } from 'react'

import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

import {
  applyCollaborativePageStatePatch,
  createCollaborativePageDoc,
  getPageStateFromCollaborativeDoc,
} from './collaborativePage.ts'
import type { PresenceState } from './collaboration.ts'
import type { PageAppState } from './pagePersistence.ts'

export type CollaborativeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'offline'

type LocationLike = Pick<Location, 'host' | 'protocol'>

type UseCollaborativePageSyncOptions = {
  enabled: boolean
  onRemoteState: (state: PageAppState) => void
  pageId: string
  state: PageAppState
}

const LOCAL_STATE_ORIGIN = 'local-state-sync'
const PENDING_LOCAL_AREA_CHANGE_TTL_MS = 1500

type PendingLocalAreaChange = {
  created?: boolean
  deleted?: boolean
  expiresAt: number
  fields: Set<string>
}

export const getCollaborativeDocumentName = (pageId: string) =>
  `page:${pageId}`

export const getCollaborationWebSocketUrl = (
  locationLike: LocationLike =
    typeof window === 'undefined'
      ? { host: 'localhost:3000', protocol: 'http:' }
      : window.location
) => {
  const protocol = locationLike.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${locationLike.host}/collaboration`
}

export const getProviderConnectionStatus = (
  status: string
): CollaborativeConnectionStatus => {
  if (status === 'connected') return 'connected'
  if (status === 'connecting') return 'connecting'

  return 'offline'
}

export const mergeRemoteStateWithPendingLocalAreaChanges = (
  remoteState: PageAppState,
  localState: PageAppState,
  pendingChanges: Map<string, PendingLocalAreaChange>,
  now = Date.now()
): PageAppState => {
  if (pendingChanges.size === 0) return remoteState

  const localAreasById = new Map(
    localState.areas.map((area) => [area.id, area])
  )
  const remoteAreaIds = new Set(remoteState.areas.map((area) => area.id))
  const mergedAreas = remoteState.areas.flatMap((remoteArea) => {
    const pendingChange = pendingChanges.get(remoteArea.id)
    if (!pendingChange) return [remoteArea]

    if (pendingChange.expiresAt <= now) {
      pendingChanges.delete(remoteArea.id)
      return [remoteArea]
    }

    if (pendingChange.deleted) {
      return []
    }

    const localArea = localAreasById.get(remoteArea.id)
    if (!localArea) {
      pendingChanges.delete(remoteArea.id)
      return [remoteArea]
    }

    const mergedArea = { ...remoteArea } as AreaState

    for (const field of Array.from(pendingChange.fields)) {
      if (areaFieldValuesEqual(remoteArea, localArea, field)) {
        pendingChange.fields.delete(field)
        continue
      }

      setAreaFieldValue(mergedArea, field, getAreaFieldValue(localArea, field))
    }

    if (pendingChange.created) {
      pendingChange.created = false
    }

    if (pendingChange.fields.size === 0 && !pendingChange.created) {
      pendingChanges.delete(remoteArea.id)
    }

    return [mergedArea]
  })

  for (const [areaId, pendingChange] of pendingChanges) {
    if (
      !pendingChange.created ||
      pendingChange.expiresAt <= now ||
      remoteAreaIds.has(areaId)
    ) {
      continue
    }

    const localArea = localAreasById.get(areaId)
    if (localArea) mergedAreas.push(localArea)
  }

  return {
    areas: mergedAreas,
    assets: remoteState.assets,
    links: remoteState.links,
    page: remoteState.page,
  }
}

export const useCollaborativePageSync = ({
  enabled,
  onRemoteState,
  pageId,
  state,
}: UseCollaborativePageSyncOptions) => {
  const initialStateRef = useRef(state)
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const applyingRemoteState = useRef(false)
  const latestLocalStateRef = useRef(state)
  const previousLocalStateRef = useRef(state)
  const pendingLocalAreaChangesRef = useRef(
    new Map<string, PendingLocalAreaChange>()
  )
  const [connectionStatus, setConnectionStatus] =
    useState<CollaborativeConnectionStatus>(
      enabled ? 'connecting' : 'offline'
    )
  const [remotePresences, setRemotePresences] = useState<
    PresenceState[]
  >([])

  useEffect(() => {
    latestLocalStateRef.current = state
  }, [state])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const doc = createCollaborativePageDoc(initialStateRef.current)
    const provider = new HocuspocusProvider({
      document: doc,
      name: getCollaborativeDocumentName(pageId),
      url: getCollaborationWebSocketUrl(),
    })

    docRef.current = doc
    providerRef.current = provider

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === LOCAL_STATE_ORIGIN) return

      const remoteState = getPageStateFromCollaborativeDoc(doc)
      const nextState = mergeRemoteStateWithPendingLocalAreaChanges(
        remoteState,
        latestLocalStateRef.current,
        pendingLocalAreaChangesRef.current
      )

      applyingRemoteState.current = true
      previousLocalStateRef.current = nextState
      onRemoteState(nextState)
    }

    const handleStatus = ({ status }: { status: string }) => {
      setConnectionStatus(getProviderConnectionStatus(status))
    }

    const updateRemotePresences = () => {
      const awareness = provider.awareness
      if (!awareness) {
        setRemotePresences([])
        return
      }

      const localClientId = awareness.clientID
      const presences = Array.from(awareness.getStates().entries())
        .filter(([clientId]) => clientId !== localClientId)
        .map(([, awarenessState]) => awarenessState.presence)
        .filter(isPresenceState)

      setRemotePresences(presences)
    }

    doc.on('update', handleDocUpdate)
    provider.on('status', handleStatus)
    provider.awareness?.on('change', updateRemotePresences)

    return () => {
      provider.awareness?.off('change', updateRemotePresences)
      provider.off('status', handleStatus)
      doc.off('update', handleDocUpdate)
      provider.destroy()
      doc.destroy()

      if (providerRef.current === provider) {
        providerRef.current = null
      }

      if (docRef.current === doc) {
        docRef.current = null
      }
    }
  }, [enabled, onRemoteState, pageId])

  useEffect(() => {
    if (!enabled || !docRef.current) return

    if (applyingRemoteState.current) {
      applyingRemoteState.current = false
      previousLocalStateRef.current = state
      return
    }

    recordPendingLocalAreaChanges(
      pendingLocalAreaChangesRef.current,
      previousLocalStateRef.current.areas,
      state.areas
    )
    applyCollaborativePageStatePatch(
      docRef.current,
      previousLocalStateRef.current,
      state,
      LOCAL_STATE_ORIGIN
    )
    previousLocalStateRef.current = state
  }, [enabled, state])

  const setPresence = useCallback((presence: PresenceState) => {
    providerRef.current?.awareness?.setLocalStateField(
      'presence',
      presence
    )
  }, [])

  return {
    connectionStatus,
    remotePresences,
    setPresence,
  }
}

const recordPendingLocalAreaChanges = (
  pendingChanges: Map<string, PendingLocalAreaChange>,
  previousAreas: AreaState[],
  nextAreas: AreaState[],
  now = Date.now()
) => {
  const expiresAt = now + PENDING_LOCAL_AREA_CHANGE_TTL_MS
  const previousAreasById = new Map(
    previousAreas.map((area) => [area.id, area])
  )
  const nextAreasById = new Map(nextAreas.map((area) => [area.id, area]))

  for (const [areaId] of previousAreasById) {
    if (nextAreasById.has(areaId)) continue

    pendingChanges.set(areaId, {
      deleted: true,
      expiresAt,
      fields: new Set(),
    })
  }

  for (const [areaId, nextArea] of nextAreasById) {
    const previousArea = previousAreasById.get(areaId)

    if (!previousArea) {
      pendingChanges.set(areaId, {
        created: true,
        expiresAt,
        fields: new Set(getComparableAreaFields(nextArea)),
      })
      continue
    }

    const changedFields = getChangedAreaFields(previousArea, nextArea)
    if (changedFields.size === 0) continue

    const pendingChange = pendingChanges.get(areaId) ?? {
      expiresAt,
      fields: new Set<string>(),
    }

    pendingChange.deleted = false
    pendingChange.expiresAt = expiresAt

    for (const field of changedFields) {
      pendingChange.fields.add(field)
    }

    pendingChanges.set(areaId, pendingChange)
  }
}

const getChangedAreaFields = (
  previousArea: AreaState,
  nextArea: AreaState
) => {
  const fields = new Set([
    ...getComparableAreaFields(previousArea),
    ...getComparableAreaFields(nextArea),
  ])
  const changedFields = new Set<string>()

  for (const field of fields) {
    if (!areaFieldValuesEqual(previousArea, nextArea, field)) {
      changedFields.add(field)
    }
  }

  return changedFields
}

const getComparableAreaFields = (area: AreaState) => [
  'parentId',
  'x',
  'y',
    'width',
    'height',
    'metadata',
    'styles',
  ...(area.type === 'image' ? ['assetId', 'alt'] : ['text']),
]

const areaFieldValuesEqual = (
  leftArea: AreaState,
  rightArea: AreaState,
  field: string
) =>
  JSON.stringify(getAreaFieldValue(leftArea, field)) ===
  JSON.stringify(getAreaFieldValue(rightArea, field))

const getAreaFieldValue = (area: AreaState, field: string) =>
  (area as unknown as Record<string, unknown>)[field]

const setAreaFieldValue = (
  area: AreaState,
  field: string,
  value: unknown
) => {
  const writableArea = area as unknown as Record<string, unknown>
  writableArea[field] = value
}

const isPresenceState = (value: unknown): value is PresenceState =>
  typeof value === 'object' &&
  value !== null &&
  'clientId' in value &&
  'userName' in value &&
  'color' in value &&
  'lastSeenAt' in value &&
  typeof value.clientId === 'string' &&
  typeof value.userName === 'string' &&
  typeof value.color === 'string' &&
  typeof value.lastSeenAt === 'number'
