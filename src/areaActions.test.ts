import assert from 'node:assert/strict'
import test from 'node:test'

import * as areaActions from './areaActions.ts'

const duplicateArea = areaActions.duplicateArea

const deleteArea = (
  areas: typeof baseAreas,
  areaId: string,
  deletedAt: number
) => {
  const fn = Reflect.get(areaActions, 'deleteArea')

  assert.equal(typeof fn, 'function')

  return fn(areas, areaId, deletedAt)
}

const restoreDeletedArea = (
  areas: typeof baseAreas,
  deletedArea: NonNullable<
    ReturnType<typeof deleteArea>['deletedArea']
  >
) => {
  const fn = Reflect.get(areaActions, 'restoreDeletedArea')

  assert.equal(typeof fn, 'function')

  return fn(areas, deletedArea)
}

const baseAreas = [
  {
    id: 'area-1',
    parentId: null,
    x: 100,
    y: 120,
    height: 56,
    width: 240,
    text: 'Original text',
    styles: {
      border: '1px solid red',
      color: 'blue',
    },
  },
  {
    id: 'area-2',
    parentId: null,
    x: 240,
    y: 260,
    height: 64,
    width: 180,
    text: 'Other area',
    styles: {},
  },
]
const areas = baseAreas

test('duplicates an area with a new id and offset position', () => {
  const result = duplicateArea(areas, 'area-1', 'area-3')

  assert.equal(result.selectedAreaId, 'area-3')
  assert.equal(result.areas.length, 3)
  assert.deepEqual(result.areas[2], {
    id: 'area-3',
    parentId: null,
    x: 116,
    y: 136,
    height: 56,
    width: 240,
    text: 'Original text',
    styles: {
      border: '1px solid red',
      color: 'blue',
    },
  })
})

test('copies styles without sharing the original styles object', () => {
  const result = duplicateArea(areas, 'area-1', 'area-3')
  const source = result.areas[0]
  const duplicate = result.areas[2]

  assert.notEqual(duplicate.styles, source.styles)
})

test('leaves areas unchanged when the source area is missing', () => {
  const result = duplicateArea(areas, 'missing-area', 'area-3')

  assert.equal(result.selectedAreaId, null)
  assert.equal(result.areas, areas)
})

test('deletes only the requested area and captures an undo snapshot', () => {
  const result = deleteArea(areas, 'area-1', 1234)

  assert.deepEqual(
    result.areas.map((area) => area.id),
    ['area-2']
  )
  assert.deepEqual(result.deletedArea, {
    area: areas[0],
    descendantAreas: [],
    index: 0,
    deletedAt: 1234,
  })
})

test('deletes child areas when deleting a parent area', () => {
  const nestedAreas = [
    areas[0],
    {
      ...areas[1],
      id: 'child-area',
      parentId: 'area-1',
    },
    areas[1],
  ]
  const result = deleteArea(nestedAreas, 'area-1', 1234)

  assert.deepEqual(
    result.areas.map((area) => area.id),
    ['area-2']
  )
  assert.deepEqual(
    result.deletedArea?.descendantAreas.map((area) => area.id),
    ['child-area']
  )
})

test('copies deleted area styles into the undo snapshot', () => {
  const result = deleteArea(areas, 'area-1', 1234)

  assert.notEqual(result.deletedArea?.area.styles, areas[0].styles)
  assert.deepEqual(result.deletedArea?.area.styles, areas[0].styles)
})

test('leaves areas unchanged when deleting a missing area', () => {
  const result = deleteArea(areas, 'missing-area', 1234)

  assert.equal(result.areas, areas)
  assert.equal(result.deletedArea, null)
})

test('restores a deleted area at its original index', () => {
  const deletedArea = deleteArea(areas, 'area-1', 1234)
    .deletedArea

  assert.ok(deletedArea)

  const restoredAreas = restoreDeletedArea(
    [areas[1]],
    deletedArea
  )

  assert.deepEqual(
    restoredAreas.map((area) => area.id),
    ['area-1', 'area-2']
  )
})

test('restores child areas when undoing a parent deletion', () => {
  const nestedAreas = [
    areas[0],
    {
      ...areas[1],
      id: 'child-area',
      parentId: 'area-1',
    },
    areas[1],
  ]
  const deletedArea = deleteArea(nestedAreas, 'area-1', 1234)
    .deletedArea

  assert.ok(deletedArea)

  const restoredAreas = restoreDeletedArea(
    [areas[1]],
    deletedArea
  )

  assert.deepEqual(
    restoredAreas.map((area) => area.id),
    ['area-1', 'child-area', 'area-2']
  )
})
