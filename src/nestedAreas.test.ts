import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAreaAbsolutePosition,
  getAreaDepth,
  getChildAreas,
  getCandidateParentId,
  getNestingCandidate,
  getUnnestingSourceId,
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

test('reports the deepest valid nesting candidate for live previews', () => {
  const previewAreas = [
    areas[0],
    {
      id: 'inner-parent',
      parentId: 'parent',
      x: 20,
      y: 24,
      width: 180,
      height: 140,
      text: 'Inner parent',
      styles: {},
    },
    {
      id: 'moving',
      parentId: null,
      x: 140,
      y: 170,
      width: 80,
      height: 48,
      text: 'Moving',
      styles: {},
    },
  ]

  assert.deepEqual(getNestingCandidate(previewAreas, 'moving'), {
    parentId: 'inner-parent',
    reason: 'valid',
  })
  assert.equal(getCandidateParentId(previewAreas, 'moving'), 'inner-parent')
})

test('live nesting candidates reject descendants and depth overflow', () => {
  assert.deepEqual(getNestingCandidate(areas, 'parent'), {
    parentId: null,
    reason: 'none',
  })

  const tooDeepAreas = [
    {
      id: 'root',
      parentId: null,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      text: 'Root',
      styles: {},
    },
    {
      id: 'level-one',
      parentId: 'root',
      x: 300,
      y: 300,
      width: 40,
      height: 40,
      text: 'Level one',
      styles: {},
    },
    {
      id: 'level-two',
      parentId: 'level-one',
      x: 300,
      y: 300,
      width: 40,
      height: 40,
      text: 'Level two',
      styles: {},
    },
    {
      id: 'deep-container',
      parentId: 'level-two',
      x: 300,
      y: 300,
      width: 220,
      height: 180,
      text: 'Container',
      styles: {},
    },
    {
      id: 'moving',
      parentId: null,
      x: 920,
      y: 920,
      width: 80,
      height: 48,
      text: 'Moving',
      styles: {},
    },
  ]

  assert.deepEqual(getNestingCandidate(tooDeepAreas, 'moving'), {
    parentId: null,
    reason: 'depth-limit',
  })
})

test('reports the current parent as an unnesting source while dragging out', () => {
  const outsideAreas = [
    areas[0],
    {
      ...areas[1],
      x: 340,
      y: 32,
    },
  ]

  assert.equal(getUnnestingSourceId(outsideAreas, 'child'), 'parent')
  assert.equal(getUnnestingSourceId(areas, 'child'), null)
})
