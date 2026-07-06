import { useCallback, useEffect, useRef, useState } from 'react'

import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

import {
  LOCAL_ORIGIN,
  applyCollaborativePageStatePatch,
  getPageStateFromCollaborativeDoc,
  isCollaborativePageDocEmpty,
  replaceCollaborativePageDocState,
} from './collaborativePage.ts'
import type { PresenceState } from './collaboration.ts'
import {
  canRedo,
  canUndo,
  createPageUndoManager,
  redo,
  undo,
  type PageUndoManager,
} from './pageUndo.ts'
import {
  createOfflinePagePersistence,
  getOfflinePageCacheKey,
  shouldSeedJsonState,
  type CollaborativeConnectionStatus,
  type OfflineCacheStatus,
} from './offlinePageCache.ts'
import type { PageAppState } from './pagePersistence.ts'

type LocationLike = Pick<Location, 'host' | 'protocol'>

type UseCollaborativePageSyncOptions = {
  enabled: boolean
  onRemoteState: (state: PageAppState) => void
  pageId: string
  state: PageAppState
}

const LOCAL_STATE_ORIGIN = 'local-state-sync'
const PENDING_LOCAL_AREA_CHANGE_TTL_MS = 1500
const LOCAL_SYNC_FLUSH_DELAY_MS = 75

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

export const createNetworkProvider = ({
  doc,
  pageId,
}: {
  doc: Y.Doc
  pageId: string
}) =>
  new HocuspocusProvider({
    document: doc,
    name: getCollaborativeDocumentName(pageId),
    url: getCollaborationWebSocketUrl(),
  })

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

    if (pendingChange.created) {
      pendingChanges.delete(remoteArea.id)
      return [remoteArea]
    }

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
    comments: remoteState.comments,
    journal: remoteState.journal,
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
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const undoManagerRef = useRef<PageUndoManager | null>(null)
  const applyingRemoteState = useRef(false)
  const hasSyncedRef = useRef(false)
  const latestLocalStateRef = useRef(state)
  const localSyncTimerRef = useRef<number | null>(null)
  const scheduledLocalStateRef = useRef<PageAppState | null>(null)
  const previousLocalStateRef = useRef(state)
  const pendingLocalAreaChangesRef = useRef(
    new Map<string, PendingLocalAreaChange>()
  )
  const [connectionStatus, setConnectionStatus] =
    useState<CollaborativeConnectionStatus>(
      enabled ? 'connecting' : 'offline'
    )
  const [offlineCacheStatus, setOfflineCacheStatus] =
    useState<OfflineCacheStatus>(
      enabled ? 'loading' : 'unavailable'
    )
  const [remotePresences, setRemotePresences] = useState<
    PresenceState[]
  >([])
  const [undoState, setUndoState] = useState({
    canRedo: false,
    canUndo: false,
  })

  const updateUndoState = useCallback(() => {
    const undoManager = undoManagerRef.current

    setUndoState({
      canUndo: undoManager ? canUndo(undoManager) : false,
      canRedo: undoManager ? canRedo(undoManager) : false,
    })
  }, [])

  useEffect(() => {
    latestLocalStateRef.current = state
  }, [state])

  const clearScheduledLocalState = useCallback(() => {
    if (localSyncTimerRef.current !== null) {
      window.clearTimeout(localSyncTimerRef.current)
      localSyncTimerRef.current = null
    }

    scheduledLocalStateRef.current = null
  }, [])

  const flushPendingLocalState = useCallback(() => {
    localSyncTimerRef.current = null

    if (!docRef.current || !hasSyncedRef.current) {
      scheduledLocalStateRef.current = null
      return
    }

    const nextState = scheduledLocalStateRef.current
    if (!nextState) return

    scheduledLocalStateRef.current = null
    recordPendingLocalAreaChanges(
      pendingLocalAreaChangesRef.current,
      previousLocalStateRef.current.areas,
      nextState.areas
    )
    applyCollaborativePageStatePatch(
      docRef.current,
      previousLocalStateRef.current,
      nextState,
      LOCAL_ORIGIN
    )
    previousLocalStateRef.current = nextState
  }, [])

  useEffect(() => {
    if (!enabled) {
      hasSyncedRef.current = false
      return
    }

    hasSyncedRef.current = false
    pendingLocalAreaChangesRef.current.clear()
    clearScheduledLocalState()

    let isDisposed = false
    const doc = new Y.Doc()
    const undoManager = createPageUndoManager(doc)
    let provider: HocuspocusProvider | null = null
    let offlinePersistence: Awaited<
      ReturnType<typeof createOfflinePagePersistence>
    > | null = null
    const resetStatusTimer = window.setTimeout(() => {
      if (isDisposed) return

      setConnectionStatus('connecting')
      setOfflineCacheStatus('loading')
    }, 0)

    docRef.current = doc
    providerRef.current = null
    undoManagerRef.current = undoManager

    const applyRemoteState = () => {
      if (scheduledLocalStateRef.current && hasSyncedRef.current) {
        flushPendingLocalState()
      }

      const remoteState = getPageStateFromCollaborativeDoc(doc)
      const nextState = mergeRemoteStateWithPendingLocalAreaChanges(
        remoteState,
        latestLocalStateRef.current,
        pendingLocalAreaChangesRef.current
      )

      applyingRemoteState.current = true
      previousLocalStateRef.current = nextState
      clearScheduledLocalState()
      onRemoteState(nextState)
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === LOCAL_STATE_ORIGIN || origin === LOCAL_ORIGIN) {
        return
      }

      applyRemoteState()
    }

    const handleUndoStackChange = () => {
      updateUndoState()
    }

    const handleSynced = ({ state: isSynced }: { state: boolean }) => {
      if (!isSynced) return

      if (
        shouldSeedJsonState({
          isCacheReady: true,
          isCollaborativeDocEmpty: isCollaborativePageDocEmpty(doc),
        })
      ) {
        const seedState = latestLocalStateRef.current
        previousLocalStateRef.current = seedState
        replaceCollaborativePageDocState(
          doc,
          seedState,
          LOCAL_STATE_ORIGIN
        )
      } else {
        applyRemoteState()
      }

      hasSyncedRef.current = true
    }

    const handleStatus = ({ status }: { status: string }) => {
      setConnectionStatus(getProviderConnectionStatus(status))
    }

    const updateRemotePresences = () => {
      if (!provider) {
        setRemotePresences([])
        return
      }

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

    const attachProvider = (nextProvider: HocuspocusProvider) => {
      provider = nextProvider
      providerRef.current = nextProvider
      nextProvider.on('synced', handleSynced)
      nextProvider.on('status', handleStatus)
      nextProvider.awareness?.on('change', updateRemotePresences)

      if (nextProvider.synced) {
        handleSynced({ state: true })
      }
    }

    doc.on('update', handleDocUpdate)
    undoManager.on('stack-item-added', handleUndoStackChange)
    undoManager.on('stack-item-popped', handleUndoStackChange)
    undoManager.on('stack-item-updated', handleUndoStackChange)

    const bootstrap = async () => {
      offlinePersistence = await createOfflinePagePersistence(
        getOfflinePageCacheKey(pageId),
        doc
      )

      if (isDisposed) {
        offlinePersistence.destroy()
        return
      }

      setOfflineCacheStatus(offlinePersistence.status)
      await offlinePersistence.synced

      if (isDisposed) return

      if (offlinePersistence.status === 'ready') {
        if (!isCollaborativePageDocEmpty(doc)) {
          applyRemoteState()
          hasSyncedRef.current = true
        }
      }

      attachProvider(createNetworkProvider({ doc, pageId }))
    }

    void bootstrap()

    return () => {
      isDisposed = true
      window.clearTimeout(resetStatusTimer)
      provider?.awareness?.off('change', updateRemotePresences)
      provider?.off('status', handleStatus)
      provider?.off('synced', handleSynced)
      undoManager.off('stack-item-updated', handleUndoStackChange)
      undoManager.off('stack-item-popped', handleUndoStackChange)
      undoManager.off('stack-item-added', handleUndoStackChange)
      doc.off('update', handleDocUpdate)
      undoManager.destroy()
      provider?.destroy()
      offlinePersistence?.destroy()
      doc.destroy()
      clearScheduledLocalState()

      if (providerRef.current === provider) {
        providerRef.current = null
      }

      if (docRef.current === doc) {
        docRef.current = null
      }

      if (undoManagerRef.current === undoManager) {
        undoManagerRef.current = null
      }

      hasSyncedRef.current = false
      setUndoState({
        canRedo: false,
        canUndo: false,
      })
      setOfflineCacheStatus('unavailable')
    }
  }, [
    clearScheduledLocalState,
    enabled,
    flushPendingLocalState,
    onRemoteState,
    pageId,
    updateUndoState,
  ])

  useEffect(() => {
    if (!enabled || !docRef.current || !hasSyncedRef.current) return

    if (applyingRemoteState.current) {
      applyingRemoteState.current = false
      previousLocalStateRef.current = state
      clearScheduledLocalState()
      return
    }

    scheduledLocalStateRef.current = state

    if (localSyncTimerRef.current !== null) return

    localSyncTimerRef.current = window.setTimeout(
      flushPendingLocalState,
      LOCAL_SYNC_FLUSH_DELAY_MS
    )
  }, [clearScheduledLocalState, enabled, flushPendingLocalState, state])

  const setPresence = useCallback((presence: PresenceState) => {
    providerRef.current?.awareness?.setLocalStateField(
      'presence',
      presence
    )
  }, [])

  const performUndo = useCallback(() => {
    const undoManager = undoManagerRef.current

    if (!undoManager || !canUndo(undoManager)) return

    undo(undoManager)
    updateUndoState()
  }, [updateUndoState])

  const performRedo = useCallback(() => {
    const undoManager = undoManagerRef.current

    if (!undoManager || !canRedo(undoManager)) return

    redo(undoManager)
    updateUndoState()
  }, [updateUndoState])

  return {
    canRedo: undoState.canRedo,
    canUndo: undoState.canUndo,
    connectionStatus,
    offlineCacheStatus,
    redo: performRedo,
    remotePresences,
    setPresence,
    undo: performUndo,
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
