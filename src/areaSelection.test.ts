import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getMarqueeRect,
  getMarqueeSelection,
  getSelectableRootAreaIds,
  isMarqueeDrag,
  normalizeSelection,
  toggleAreaSelection,
} from './areaSelection.ts'

const makeArea = (
  id: string,
  x: number,
  y: number,
  overrides: Partial<{
    parentId: string | null
    width: number
    height: number
  }> = {}
) => ({
  id,
  parentId: overrides.parentId ?? null,
  x,
  y,
  width: overrides.width ?? 100,
  height: overrides.height ?? 50,
})

test('toggle adds an unselected area and removes a selected one', () => {
  assert.deepEqual(toggleAreaSelection([], 'a'), ['a'])
  assert.deepEqual(toggleAreaSelection(['a', 'b'], 'a'), ['b'])
  assert.deepEqual(toggleAreaSelection(['a'], 'b'), ['a', 'b'])
})

test('marquee drag requires exceeding the threshold', () => {
  assert.equal(
    isMarqueeDrag({ x: 10, y: 10 }, { x: 13, y: 12 }),
    false
  )
  assert.equal(
    isMarqueeDrag({ x: 10, y: 10 }, { x: 15, y: 10 }),
    true
  )
  assert.equal(
    isMarqueeDrag({ x: 10, y: 10 }, { x: 10, y: 3 }),
    true
  )
})

test('marquee rect normalizes any drag direction', () => {
  assert.deepEqual(
    getMarqueeRect({ x: 100, y: 80 }, { x: 20, y: 30 }),
    { x: 20, y: 30, width: 80, height: 50 }
  )
})

test('marquee selects intersecting root areas only', () => {
  const areas = [
    makeArea('inside', 20, 20),
    makeArea('overlapping', 90, 40),
    makeArea('outside', 400, 400),
    makeArea('nested', 30, 30, { parentId: 'inside' }),
  ]

  assert.deepEqual(
    getMarqueeSelection(
      { x: 0, y: 0, width: 120, height: 100 },
      areas
    ),
    ['inside', 'overlapping']
  )
})

test('a rect that only touches edges does not select', () => {
  const areas = [makeArea('a', 100, 100)]

  assert.deepEqual(
    getMarqueeSelection(
      { x: 0, y: 0, width: 100, height: 100 },
      areas
    ),
    []
  )
})

test('normalize drops stale ids and nested descendants of selected ancestors', () => {
  const areas = [
    makeArea('parent', 0, 0),
    makeArea('child', 10, 10, { parentId: 'parent' }),
    makeArea('grandchild', 5, 5, { parentId: 'child' }),
    makeArea('other', 300, 300),
  ]

  assert.deepEqual(
    normalizeSelection(
      ['parent', 'child', 'grandchild', 'other', 'gone'],
      areas
    ),
    ['parent', 'other']
  )
})

test('normalize keeps a child selected when its ancestor is not', () => {
  const areas = [
    makeArea('parent', 0, 0),
    makeArea('child', 10, 10, { parentId: 'parent' }),
  ]

  assert.deepEqual(normalizeSelection(['child'], areas), [
    'child',
  ])
})

test('selectable root ids exclude nested areas', () => {
  const areas = [
    makeArea('a', 0, 0),
    makeArea('b', 10, 10, { parentId: 'a' }),
    makeArea('c', 200, 0),
  ]

  assert.deepEqual(getSelectableRootAreaIds(areas), ['a', 'c'])
})
