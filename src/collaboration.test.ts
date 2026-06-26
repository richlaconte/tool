import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyPageOperation,
  canPublishCollaborationOperation,
  createCollaborationProfile,
  createPresenceState,
  getCollaborationProfileFromCookie,
  pruneStalePresences,
  serializeCollaborationProfileCookie,
} from './collaboration.ts'
import { createDefaultPageState } from './pagePersistence.ts'

const now = '2026-06-26T12:00:00.000Z'

const baseArea = {
  id: 'area-1',
  parentId: null,
  x: 100,
  y: 120,
  height: 56,
  width: 240,
  text: 'Original text',
  styles: {
    border: '1px solid red',
  },
}

const baseState = {
  page: createDefaultPageState({ id: 'page-1', now }),
  areas: [baseArea],
  assets: [],
}

test('creates a collaboration profile with stable display fields', () => {
  const profile = createCollaborationProfile(() => 'client-1')

  assert.equal(profile.clientId, 'client-1')
  assert.ok(profile.userName.length > 0)
  assert.match(profile.color, /^#[0-9a-f]{6}$/i)
})

test('serializes and restores the collaboration profile from a cookie', () => {
  const profile = {
    clientId: 'client-1',
    userName: 'Ada',
    color: '#2563eb',
  }
  const cookie = serializeCollaborationProfileCookie(profile)

  assert.deepEqual(
    getCollaborationProfileFromCookie(cookie),
    profile
  )
})

test('merges area style operations by CSS property', () => {
  const nextState = applyPageOperation(baseState, {
    type: 'area:update',
    id: 'area-1',
    patch: {
      styles: {
        color: 'blue',
      },
    },
  })

  assert.deepEqual(nextState.areas[0].styles, {
    border: '1px solid red',
    color: 'blue',
  })
})

test('deletes an area and its descendants through operations', () => {
  const childArea = {
    ...baseArea,
    id: 'child-area',
    parentId: 'area-1',
    x: 20,
    y: 24,
  }
  const nextState = applyPageOperation(
    {
      ...baseState,
      areas: [baseArea, childArea],
    },
    {
      type: 'area:delete',
      id: 'area-1',
    }
  )

  assert.deepEqual(nextState.areas, [])
})

test('updates page settings without dropping unrelated settings', () => {
  const nextState = applyPageOperation(baseState, {
    type: 'page-settings:update',
    patch: {
      background: '#f8fafc',
      snapGrid: {
        enabled: true,
      },
    },
  })

  assert.equal(nextState.page.settings.background, '#f8fafc')
  assert.equal(nextState.page.settings.snapGrid.enabled, true)
  assert.equal(nextState.page.settings.snapGrid.size, 16)
  assert.deepEqual(nextState.page.settings.theme.colors, [])
})

test('blocks view-only users from publishing collaboration operations', () => {
  assert.equal(
    canPublishCollaborationOperation('view', {
      type: 'area:delete',
      id: 'area-1',
    }),
    false
  )
  assert.equal(
    canPublishCollaborationOperation('edit', {
      type: 'area:delete',
      id: 'area-1',
    }),
    true
  )
})

test('creates and prunes presence state by freshness', () => {
  const recentPresence = createPresenceState(
    {
      clientId: 'client-1',
      userName: 'Ada',
      color: '#2563eb',
    },
    {
      cursor: {
        x: 40,
        y: 60,
      },
      selectedAreaId: 'area-1',
    },
    10_000
  )

  assert.deepEqual(recentPresence.cursor, { x: 40, y: 60 })
  assert.equal(recentPresence.selectedAreaId, 'area-1')
  assert.deepEqual(
    pruneStalePresences(
      [
        recentPresence,
        {
          ...recentPresence,
          clientId: 'stale-client',
          lastSeenAt: 0,
        },
      ],
      20_000
    ).map((presence) => presence.clientId),
    ['client-1']
  )
})
