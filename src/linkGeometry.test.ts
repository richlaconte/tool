import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAreaBorderHit,
  getAreaEndpointPoint,
  moveSharedLinkEndpoint,
  snapLinkEndpointToExisting,
} from './linkGeometry.ts'
import type { AreaLink } from './areaMetadata.ts'

const now = '2026-06-30T12:00:00.000Z'
const rect = {
  x: 100,
  y: 120,
  width: 240,
  height: 120,
}

const createLink = (
  id: string,
  fromPosition: number,
  toPosition = 0.5
): AreaLink => ({
  id,
  fromAreaId: 'source',
  toAreaId: 'target',
  kind: 'relates-to',
  from: {
    areaId: 'source',
    side: 'right',
    position: fromPosition,
    behavior: 'fixed',
  },
  to: {
    areaId: 'target',
    side: 'left',
    position: toPosition,
    behavior: 'fixed',
  },
  visual: {
    mode: 'simple',
    direction: 'forward',
    route: 'straight',
    labelVisibility: 'auto',
  },
  createdAt: now,
  updatedAt: now,
})

test('border hit testing returns the nearest side and normalized position', () => {
  assert.deepEqual(getAreaBorderHit(rect, { x: 160, y: 116 }, 12), {
    side: 'top',
    position: 0.25,
  })
  assert.deepEqual(getAreaBorderHit(rect, { x: 344, y: 180 }, 12), {
    side: 'right',
    position: 0.5,
  })
  assert.equal(getAreaBorderHit(rect, { x: 220, y: 180 }, 12), null)
})

test('endpoint points use normalized side positions', () => {
  assert.deepEqual(
    getAreaEndpointPoint(rect, {
      areaId: 'source',
      side: 'bottom',
      position: 0.75,
      behavior: 'fixed',
    }),
    {
      x: 280,
      y: 240,
    }
  )
})

test('endpoint snapping reuses a nearby existing point on the same side', () => {
  const snapped = snapLinkEndpointToExisting({
    area: rect,
    areaId: 'source',
    links: [createLink('link-1', 0.5)],
    maxDistance: 8,
    side: 'right',
    position: 0.55,
  })

  assert.deepEqual(snapped, {
    areaId: 'source',
    side: 'right',
    position: 0.5,
    behavior: 'fixed',
  })

  assert.deepEqual(
    snapLinkEndpointToExisting({
      area: rect,
      areaId: 'source',
      links: [createLink('link-1', 0.5)],
      maxDistance: 8,
      side: 'top',
      position: 0.5,
    }),
    {
      areaId: 'source',
      side: 'top',
      position: 0.5,
      behavior: 'fixed',
    }
  )
})

test('moving a shared endpoint updates every matching connector endpoint', () => {
  const links = [
    createLink('link-1', 0.5),
    createLink('link-2', 0.5),
    createLink('link-3', 0.2),
  ]
  const nextLinks = moveSharedLinkEndpoint(links, {
    from: {
      areaId: 'source',
      side: 'right',
      position: 0.5,
      behavior: 'fixed',
    },
    to: {
      areaId: 'source',
      side: 'bottom',
      position: 0.25,
      behavior: 'fixed',
    },
  })

  assert.deepEqual(
    nextLinks.map((link) => link.from),
    [
      {
        areaId: 'source',
        side: 'bottom',
        position: 0.25,
        behavior: 'fixed',
      },
      {
        areaId: 'source',
        side: 'bottom',
        position: 0.25,
        behavior: 'fixed',
      },
      {
        areaId: 'source',
        side: 'right',
        position: 0.2,
        behavior: 'fixed',
      },
    ]
  )
})
