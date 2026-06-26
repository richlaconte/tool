import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampSnapGridSize,
  getActiveSnapGridSize,
  moveAreaWithSnapGrid,
  snapValueToGrid,
} from './snapGrid.ts'

const areas = [
  {
    id: 'area-1',
    x: 100,
    y: 120,
    height: 32,
    width: 200,
    text: 'Move me',
    styles: {},
  },
  {
    id: 'area-2',
    x: 260,
    y: 280,
    height: 64,
    width: 180,
    text: 'Stay put',
    styles: {},
  },
]

test('clamps snap grid size to a safe direct-input range', () => {
  assert.equal(clampSnapGridSize(2), 4)
  assert.equal(clampSnapGridSize(16), 16)
  assert.equal(clampSnapGridSize(400), 128)
  assert.equal(clampSnapGridSize(Number.NaN), 16)
})

test('snaps values to the nearest grid increment', () => {
  assert.equal(snapValueToGrid(103, 16), 96)
  assert.equal(snapValueToGrid(105, 16), 112)
  assert.equal(snapValueToGrid(280, 20), 280)
})

test('returns an active snap grid size only when enabled and not bypassed', () => {
  assert.equal(
    getActiveSnapGridSize({
      enabled: false,
      size: 16,
      visible: true,
    }),
    undefined
  )
  assert.equal(
    getActiveSnapGridSize(
      {
        enabled: true,
        size: 16,
        visible: true,
      },
      true
    ),
    undefined
  )
  assert.equal(
    getActiveSnapGridSize({
      enabled: true,
      size: 20,
      visible: false,
    }),
    20
  )
})

test('moves only the target area to snapped coordinates', () => {
  const nextAreas = moveAreaWithSnapGrid(areas, 'area-1', 109, 129, {
    snapGridSize: 16,
  })

  assert.equal(nextAreas[0].x, 112)
  assert.equal(nextAreas[0].y, 128)
  assert.equal(nextAreas[1].x, 260)
  assert.equal(nextAreas[1].y, 280)
})

test('moves freely when the snap grid is bypassed', () => {
  const nextAreas = moveAreaWithSnapGrid(areas, 'area-1', 109, 129)

  assert.equal(nextAreas[0].x, 109)
  assert.equal(nextAreas[0].y, 129)
})
