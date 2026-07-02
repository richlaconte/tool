import assert from 'node:assert/strict'
import test from 'node:test'

import {
  alignAreas,
  distributeAreas,
} from './areaAlignment.ts'

const area = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50
) => ({ id, x, y, width, height })

const positionOf = (
  updates: Array<{ id: string; x: number; y: number }>,
  id: string
) => {
  const update = updates.find((entry) => entry.id === id)

  assert.ok(update, `missing update for ${id}`)

  return update
}

test('align left moves areas to the leftmost edge', () => {
  const updates = alignAreas(
    [area('a', 10, 0), area('b', 50, 100)],
    'left'
  )

  assert.equal(positionOf(updates, 'a').x, 10)
  assert.equal(positionOf(updates, 'b').x, 10)
  assert.equal(positionOf(updates, 'b').y, 100)
})

test('align right respects differing widths', () => {
  const updates = alignAreas(
    [area('a', 0, 0, 100), area('b', 50, 100, 40)],
    'right'
  )

  assert.equal(positionOf(updates, 'a').x, 0)
  assert.equal(positionOf(updates, 'b').x, 60)
})

test('align top and bottom move vertically only', () => {
  const areas = [area('a', 0, 20), area('b', 200, 80)]

  const top = alignAreas(areas, 'top')

  assert.equal(positionOf(top, 'b').y, 20)
  assert.equal(positionOf(top, 'b').x, 200)

  const bottom = alignAreas(areas, 'bottom')

  assert.equal(positionOf(bottom, 'a').y, 80)
})

test('center alignment centers on the selection bounding box', () => {
  const updates = alignAreas(
    [area('a', 0, 0, 100), area('b', 200, 100, 50)],
    'center-x'
  )

  assert.equal(positionOf(updates, 'a').x, 75)
  assert.equal(positionOf(updates, 'b').x, 100)
})

test('already aligned areas produce identical positions', () => {
  const areas = [area('a', 30, 0), area('b', 30, 100)]
  const updates = alignAreas(areas, 'left')

  assert.equal(positionOf(updates, 'a').x, 30)
  assert.equal(positionOf(updates, 'b').x, 30)
})

test('align requires at least two areas', () => {
  assert.deepEqual(alignAreas([area('a', 0, 0)], 'left'), [])
})

test('distribute horizontal spaces gaps evenly and keeps ends fixed', () => {
  const updates = distributeAreas(
    [
      area('a', 0, 0, 100),
      area('c', 500, 0, 100),
      area('b', 120, 0, 100),
    ],
    'horizontal'
  )

  assert.equal(positionOf(updates, 'a').x, 0)
  assert.equal(positionOf(updates, 'b').x, 250)
  assert.equal(positionOf(updates, 'c').x, 500)
})

test('distribute vertical handles uneven sizes', () => {
  const updates = distributeAreas(
    [
      area('a', 0, 0, 100, 50),
      area('b', 0, 60, 100, 100),
      area('c', 0, 400, 100, 20),
    ],
    'vertical'
  )

  assert.equal(positionOf(updates, 'a').y, 0)
  assert.equal(positionOf(updates, 'b').y, 175)
  assert.equal(positionOf(updates, 'c').y, 400)
})

test('distribute requires at least three areas', () => {
  assert.deepEqual(
    distributeAreas(
      [area('a', 0, 0), area('b', 10, 10)],
      'horizontal'
    ),
    []
  )
})
