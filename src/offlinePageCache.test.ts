import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getOfflinePageCacheKey,
  getOfflineSyncStatus,
  shouldSeedJsonState,
} from './offlinePageCache.ts'

test('builds a stable per-page offline cache key', () => {
  assert.equal(
    getOfflinePageCacheKey('page_123'),
    'cascadery-page-page_123'
  )
})

test('seeds legacy JSON only after local cache and server state are empty', () => {
  assert.equal(
    shouldSeedJsonState({
      isCacheReady: true,
      isCollaborativeDocEmpty: true,
    }),
    true
  )
  assert.equal(
    shouldSeedJsonState({
      isCacheReady: true,
      isCollaborativeDocEmpty: false,
    }),
    false
  )
  assert.equal(
    shouldSeedJsonState({
      isCacheReady: false,
      isCollaborativeDocEmpty: true,
    }),
    false
  )
})

test('reports calm offline and reconnecting status labels', () => {
  assert.deepEqual(
    getOfflineSyncStatus({
      connectionStatus: 'offline',
      offlineCacheStatus: 'ready',
    }),
    {
      collaborationStatus: 'offline',
      saveStatus: 'saved-locally',
    }
  )
  assert.deepEqual(
    getOfflineSyncStatus({
      connectionStatus: 'connecting',
      offlineCacheStatus: 'ready',
    }),
    {
      collaborationStatus: 'syncing',
      saveStatus: 'syncing',
    }
  )
  assert.deepEqual(
    getOfflineSyncStatus({
      connectionStatus: 'offline',
      offlineCacheStatus: 'unavailable',
    }),
    {
      collaborationStatus: 'offline',
      saveStatus: 'offline-unavailable',
    }
  )
})
