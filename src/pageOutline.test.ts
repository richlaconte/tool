import assert from 'node:assert/strict'
import test from 'node:test'

import { getPageOutline } from './pageOutline.ts'
import { createDefaultPageState } from './pagePersistence.ts'

test('page outline lists root areas in reading order with children nested', () => {
  const outline = getPageOutline({
    page: createDefaultPageState({
      id: 'page-outline',
      now: '2026-07-05T12:00:00.000Z',
    }),
    assets: [],
    areas: [
      {
        id: 'second',
        parentId: null,
        x: 20,
        y: 220,
        width: 160,
        height: 100,
        text: 'Second root',
        styles: {},
      },
      {
        id: 'first',
        parentId: null,
        x: 20,
        y: 20,
        width: 160,
        height: 100,
        text: 'First root',
        styles: {},
      },
      {
        id: 'child',
        parentId: 'first',
        x: 16,
        y: 28,
        width: 120,
        height: 80,
        text: 'Child item',
        styles: {},
      },
    ],
  })

  assert.deepEqual(
    outline.map((item) => item.areaId),
    ['first', 'second']
  )
  assert.deepEqual(outline[0].children.map((item) => item.areaId), [
    'child',
  ])
  assert.equal(outline[0].title, 'First root')
  assert.equal(outline[0].children[0].depth, 1)
})
