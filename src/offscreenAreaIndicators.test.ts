import assert from 'node:assert/strict'
import test from 'node:test'

import type { AreaState } from './App.tsx'
import {
  getOffscreenAreaIndicators,
  getOffscreenIndicatorAriaLabel,
} from './offscreenAreaIndicators.ts'

const createArea = (
  id: string,
  overrides: Partial<AreaState> = {}
): AreaState => ({
  id,
  parentId: null,
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  text: id,
  styles: {},
  ...overrides,
})

const baseInput = {
  viewport: {
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  },
  viewportPixelSize: {
    width: 800,
    height: 600,
  },
  zoom: 2,
  safeInsets: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
}

test('does not create indicators for areas visible in the viewport', () => {
  const indicators = getOffscreenAreaIndicators({
    ...baseInput,
    areas: [
      createArea('visible', {
        x: 120,
        y: 80,
      }),
    ],
  })

  assert.deepEqual(indicators, [])
})

test('groups offscreen areas in the same direction with a count and target bounds', () => {
  const indicators = getOffscreenAreaIndicators({
    ...baseInput,
    areas: [
      createArea('east-one', {
        x: 520,
        y: 80,
      }),
      createArea('east-two', {
        x: 650,
        y: 150,
      }),
      createArea('south', {
        x: 160,
        y: 430,
      }),
    ],
  })

  assert.deepEqual(
    indicators.map((indicator) => ({
      direction: indicator.direction,
      count: indicator.count,
      areaIds: indicator.areaIds,
    })),
    [
      {
        direction: 'east',
        count: 2,
        areaIds: ['east-one', 'east-two'],
      },
      {
        direction: 'south',
        count: 1,
        areaIds: ['south'],
      },
    ]
  )
  assert.deepEqual(indicators[0].targetBounds, {
    x: 520,
    y: 80,
    width: 230,
    height: 150,
  })
  assert.equal(
    getOffscreenIndicatorAriaLabel(indicators[0]),
    '2 Areas offscreen east'
  )
})

test('uses nested area absolute bounds when assigning directions', () => {
  const indicators = getOffscreenAreaIndicators({
    ...baseInput,
    areas: [
      createArea('parent', {
        x: 460,
        y: 40,
        width: 220,
        height: 180,
      }),
      createArea('child', {
        parentId: 'parent',
        x: 32,
        y: 40,
        width: 90,
        height: 70,
      }),
    ],
  })

  assert.equal(indicators.length, 1)
  assert.equal(indicators[0].direction, 'east')
  assert.deepEqual(indicators[0].areaIds, ['parent', 'child'])
  assert.deepEqual(indicators[0].targetBounds, {
    x: 460,
    y: 40,
    width: 220,
    height: 180,
  })
})

test('clamps indicator positions to safe insets and sorts clockwise from north', () => {
  const indicators = getOffscreenAreaIndicators({
    ...baseInput,
    safeInsets: {
      top: 72,
      right: 28,
      bottom: 64,
      left: 28,
    },
    areas: [
      createArea('west', {
        x: -220,
        y: 120,
      }),
      createArea('north', {
        x: 160,
        y: -180,
      }),
      createArea('northeast', {
        x: 520,
        y: -140,
      }),
    ],
  })

  assert.deepEqual(
    indicators.map((indicator) => indicator.direction),
    ['north', 'northeast', 'west']
  )

  for (const indicator of indicators) {
    assert.ok(indicator.viewportPosition.x >= 28)
    assert.ok(indicator.viewportPosition.x <= 772)
    assert.ok(indicator.viewportPosition.y >= 72)
    assert.ok(indicator.viewportPosition.y <= 536)
  }
})
