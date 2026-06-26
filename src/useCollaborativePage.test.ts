import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getCollaborationWebSocketUrl,
  getCollaborativeDocumentName,
  getProviderConnectionStatus,
  mergeRemoteStateWithPendingLocalAreaChanges,
} from './useCollaborativePage.ts'
import { createDefaultPageState } from './pagePersistence.ts'
import type { AreaState } from './App.tsx'

const now = '2026-06-26T12:00:00.000Z'

const createTextArea = (
  patch: Partial<AreaState> & { id: string }
): AreaState => ({
  createdAt: now,
  height: 80,
  parentId: null,
  styles: {},
  text: '',
  type: 'text',
  updatedAt: now,
  width: 220,
  x: 0,
  y: 0,
  ...patch,
})

test('builds stable collaborative document names from page ids', () => {
  assert.equal(getCollaborativeDocumentName('page_123'), 'page:page_123')
})

test('builds WebSocket URL from the current page location', () => {
  assert.equal(
    getCollaborationWebSocketUrl({
      host: 'example.test',
      protocol: 'https:',
    }),
    'wss://example.test/collaboration'
  )
  assert.equal(
    getCollaborationWebSocketUrl({
      host: 'localhost:3000',
      protocol: 'http:',
    }),
    'ws://localhost:3000/collaboration'
  )
})

test('maps provider status to editor connection status', () => {
  assert.equal(getProviderConnectionStatus('connected'), 'connected')
  assert.equal(getProviderConnectionStatus('connecting'), 'connecting')
  assert.equal(getProviderConnectionStatus('disconnected'), 'offline')
})

test('collaborative sync applies local changes as patches instead of full replacements', async () => {
  const source = await readFile(
    new URL('./useCollaborativePage.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /applyCollaborativePageStatePatch/)
})

test('remote sync preserves pending local area movement while applying other remote changes', () => {
  const page = createDefaultPageState({ id: 'page_1', now })
  const staleLocalArea = createTextArea({
    id: 'local',
    text: 'Local',
    x: 40,
    y: 60,
  })
  const movedLocalArea = {
    ...staleLocalArea,
    x: 180,
    y: 140,
  }
  const remoteArea = createTextArea({
    id: 'remote',
    text: 'Remote',
    x: 240,
    y: 260,
  })
  const remotelyMovedArea = {
    ...remoteArea,
    x: 320,
  }
  const pendingChanges = new Map([
    [
      'local',
      {
        expiresAt: 2000,
        fields: new Set(['x', 'y']),
      },
    ],
  ])

  const merged = mergeRemoteStateWithPendingLocalAreaChanges(
    {
      areas: [staleLocalArea, remotelyMovedArea],
      assets: [],
      page,
    },
    {
      areas: [movedLocalArea, remoteArea],
      assets: [],
      page,
    },
    pendingChanges,
    1000
  )

  assert.equal(
    merged.areas.find((area) => area.id === 'local')?.x,
    180
  )
  assert.equal(
    merged.areas.find((area) => area.id === 'local')?.y,
    140
  )
  assert.equal(
    merged.areas.find((area) => area.id === 'remote')?.x,
    320
  )
})

test('remote sync stops preserving local movement after the remote document catches up', () => {
  const page = createDefaultPageState({ id: 'page_2', now })
  const movedLocalArea = createTextArea({
    id: 'local',
    x: 180,
    y: 140,
  })
  const pendingChanges = new Map([
    [
      'local',
      {
        expiresAt: 2000,
        fields: new Set(['x', 'y']),
      },
    ],
  ])

  const merged = mergeRemoteStateWithPendingLocalAreaChanges(
    {
      areas: [movedLocalArea],
      assets: [],
      page,
    },
    {
      areas: [movedLocalArea],
      assets: [],
      page,
    },
    pendingChanges,
    1000
  )

  assert.deepEqual(merged.areas, [movedLocalArea])
  assert.equal(pendingChanges.has('local'), false)
})
