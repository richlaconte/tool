import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAreaAbsolutePosition,
  getAreaDepth,
  getChildAreas,
  getRootAreas,
  nestAreaIfContained,
  reparentArea,
} from './nestedAreas.ts'

const areas = [
  {
    id: 'parent',
    parentId: null,
    x: 100,
    y: 120,
    width: 300,
    height: 220,
    text: 'Parent',
    styles: {},
  },
  {
    id: 'child',
    parentId: 'parent',
    x: 24,
    y: 32,
    width: 100,
    height: 60,
    text: 'Child',
    styles: {},
  },
  {
    id: 'sibling',
    parentId: null,
    x: 460,
    y: 140,
    width: 120,
    height: 80,
    text: 'Sibling',
    styles: {},
  },
]

test('groups root and child areas by parent id', () => {
  assert.deepEqual(
    getRootAreas(areas).map((area) => area.id),
    ['parent', 'sibling']
  )
  assert.deepEqual(
    getChildAreas(areas, 'parent').map((area) => area.id),
    ['child']
  )
})

test('computes absolute positions through parent chains', () => {
  assert.deepEqual(getAreaAbsolutePosition(areas, 'parent'), {
    x: 100,
    y: 120,
  })
  assert.deepEqual(getAreaAbsolutePosition(areas, 'child'), {
    x: 124,
    y: 152,
  })
})

test('reparents a top-level area into a parent with relative coordinates', () => {
  const floatingAreas = [
    areas[0],
    {
      id: 'floating',
      parentId: null,
      x: 180,
      y: 210,
      width: 80,
      height: 48,
      text: 'Floating',
      styles: {},
    },
  ]
  const nextAreas = reparentArea(floatingAreas, 'floating', 'parent')
  const floating = nextAreas.find((area) => area.id === 'floating')

  assert.equal(floating?.parentId, 'parent')
  assert.equal(floating?.x, 80)
  assert.equal(floating?.y, 90)
})

test('reparents a child out to the page with absolute coordinates', () => {
  const nextAreas = reparentArea(areas, 'child', null)
  const child = nextAreas.find((area) => area.id === 'child')

  assert.equal(child?.parentId, null)
  assert.equal(child?.x, 124)
  assert.equal(child?.y, 152)
})

test('does not allow cyclic parent relationships', () => {
  const nextAreas = reparentArea(areas, 'parent', 'child')

  assert.equal(nextAreas, areas)
})

test('nests an area when it is fully inside another area', () => {
  const movingAreas = [
    areas[0],
    {
      id: 'moving',
      parentId: null,
      x: 160,
      y: 190,
      width: 80,
      height: 48,
      text: 'Moving',
      styles: {},
    },
  ]
  const nextAreas = nestAreaIfContained(movingAreas, 'moving')
  const moving = nextAreas.find((area) => area.id === 'moving')

  assert.equal(moving?.parentId, 'parent')
  assert.deepEqual(getAreaAbsolutePosition(nextAreas, 'moving'), {
    x: 160,
    y: 190,
  })
})

test('unnests a child when it leaves its parent bounds', () => {
  const outsideAreas = [
    areas[0],
    {
      ...areas[1],
      x: 340,
      y: 32,
    },
  ]
  const nextAreas = nestAreaIfContained(outsideAreas, 'child')
  const child = nextAreas.find((area) => area.id === 'child')

  assert.equal(child?.parentId, null)
  assert.deepEqual(getAreaAbsolutePosition(nextAreas, 'child'), {
    x: 440,
    y: 152,
  })
})

test('reports nesting depth', () => {
  assert.equal(getAreaDepth(areas, 'parent'), 0)
  assert.equal(getAreaDepth(areas, 'child'), 1)
})
