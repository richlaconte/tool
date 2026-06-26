import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_AREA_HEIGHT,
  DEFAULT_AREA_WIDTH,
  MIN_AREA_HEIGHT,
  MIN_AREA_WIDTH,
  resizeAreaDimensions,
  resizeAreaWidth,
} from './areaResize.ts'

const areas = [
  {
    id: 'area-1',
    x: 100,
    y: 120,
    height: DEFAULT_AREA_HEIGHT,
    width: DEFAULT_AREA_WIDTH,
    text: 'Resizable area',
    styles: {},
  },
  {
    id: 'area-2',
    x: 260,
    y: 280,
    height: 64,
    width: 180,
    text: 'Other area',
    styles: {},
  },
]

test('resizes only the target area width', () => {
  const nextAreas = resizeAreaWidth(areas, 'area-1', 260)

  assert.equal(nextAreas[0].width, 260)
  assert.equal(nextAreas[1].width, 180)
})

test('resizes target area width and height', () => {
  const nextAreas = resizeAreaDimensions(
    areas,
    'area-1',
    260,
    96
  )

  assert.equal(nextAreas[0].width, 260)
  assert.equal(nextAreas[0].height, 96)
  assert.equal(nextAreas[1].width, 180)
  assert.equal(nextAreas[1].height, 64)
})

test('does not move the area origin while resizing', () => {
  const nextAreas = resizeAreaDimensions(
    areas,
    'area-1',
    260,
    96
  )

  assert.equal(nextAreas[0].x, 100)
  assert.equal(nextAreas[0].y, 120)
})

test('clamps width to the minimum usable text width', () => {
  const nextAreas = resizeAreaWidth(areas, 'area-1', 20)

  assert.equal(nextAreas[0].width, MIN_AREA_WIDTH)
})

test('clamps height to the minimum usable text height', () => {
  const nextAreas = resizeAreaDimensions(
    areas,
    'area-1',
    260,
    10
  )

  assert.equal(nextAreas[0].height, MIN_AREA_HEIGHT)
})

test('clamps width to an optional maximum width', () => {
  const nextAreas = resizeAreaWidth(areas, 'area-1', 500, {
    maxWidth: 320,
  })

  assert.equal(nextAreas[0].width, 320)
})

test('clamps height to an optional maximum height', () => {
  const nextAreas = resizeAreaDimensions(
    areas,
    'area-1',
    260,
    500,
    {
      maxHeight: 320,
    }
  )

  assert.equal(nextAreas[0].height, 320)
})

test('snaps width to the active grid size when provided', () => {
  const nextAreas = resizeAreaWidth(areas, 'area-1', 213, {
    snapGridSize: 20,
  })

  assert.equal(nextAreas[0].width, 220)
})

test('snaps height to the active grid size when provided', () => {
  const nextAreas = resizeAreaDimensions(
    areas,
    'area-1',
    213,
    87,
    {
      snapGridSize: 20,
    }
  )

  assert.equal(nextAreas[0].width, 220)
  assert.equal(nextAreas[0].height, 80)
})

test('returns unchanged areas when the target is missing', () => {
  const nextAreas = resizeAreaWidth(areas, 'missing-area', 260)

  assert.equal(nextAreas, areas)
})
