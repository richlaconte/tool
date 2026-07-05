import type * as Y from 'yjs'

export type CollaborativeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'offline'

export type OfflineCacheStatus = 'loading' | 'ready' | 'unavailable'

export type OfflineSaveStatus =
  | 'saved'
  | 'syncing'
  | 'saved-locally'
  | 'offline-unavailable'

export type OfflineCollaborationStatus =
  | 'connected'
  | 'syncing'
  | 'offline'

type OfflinePagePersistence = {
  status: OfflineCacheStatus
  synced: Promise<void>
  destroy: () => void
}

type IndexeddbPersistenceLike = {
  whenSynced: Promise<unknown>
  destroy: () => Promise<void>
}

const IDB_PROBE_NAME = 'cascadery-offline-cache-probe'

export const getOfflinePageCacheKey = (pageId: string) =>
  `cascadery-page-${pageId}`

export const shouldSeedJsonState = ({
  isCacheReady,
  isCollaborativeDocEmpty,
}: {
  isCacheReady: boolean
  isCollaborativeDocEmpty: boolean
}) => isCacheReady && isCollaborativeDocEmpty

export const getOfflineSyncStatus = ({
  connectionStatus,
  offlineCacheStatus,
}: {
  connectionStatus: CollaborativeConnectionStatus
  offlineCacheStatus: OfflineCacheStatus
}): {
  collaborationStatus: OfflineCollaborationStatus
  saveStatus: OfflineSaveStatus
} => {
  if (connectionStatus === 'connected') {
    return {
      collaborationStatus: 'connected',
      saveStatus: 'saved',
    }
  }

  if (connectionStatus === 'connecting') {
    return {
      collaborationStatus: 'syncing',
      saveStatus: 'syncing',
    }
  }

  return {
    collaborationStatus: 'offline',
    saveStatus:
      offlineCacheStatus === 'ready'
        ? 'saved-locally'
        : 'offline-unavailable',
  }
}

export const createOfflinePagePersistence = async (
  cacheKey: string,
  doc: Y.Doc
): Promise<OfflinePagePersistence> => {
  if (!(await canUseIndexedDb())) {
    return createUnavailablePersistence()
  }

  try {
    const { IndexeddbPersistence } = await import('y-indexeddb')
    const persistence = new IndexeddbPersistence(
      cacheKey,
      doc
    ) as IndexeddbPersistenceLike

    return {
      status: 'ready',
      synced: persistence.whenSynced.then(() => undefined),
      destroy: () => {
        void persistence.destroy()
      },
    }
  } catch {
    return createUnavailablePersistence()
  }
}

const createUnavailablePersistence = (): OfflinePagePersistence => ({
  status: 'unavailable',
  synced: Promise.resolve(),
  destroy: () => undefined,
})

const canUseIndexedDb = async () => {
  if (typeof indexedDB === 'undefined') return false

  try {
    const db = await openProbeDatabase()
    db.close()
    indexedDB.deleteDatabase(IDB_PROBE_NAME)

    return true
  } catch {
    return false
  }
}

const openProbeDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IDB_PROBE_NAME, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore('probe')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB unavailable.'))
    request.onblocked = () => reject(new Error('IndexedDB blocked.'))
  })
