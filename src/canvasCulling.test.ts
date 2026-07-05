import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getVisibleAreaIds,
  getVisibleCanvasRect,
  isAreaLinkVisible,
} from './canvasCulling.ts'
import type { AreaState } from './App.tsx'

const areas: AreaState[] = [
  {
    id: 'visible',
    parentId: null,
    x: 100,
    y: 100,
    width: 160,
    height: 100,
    text: 'Visible',
    styles: {},
  },
  {
    id: 'distant',
    parentId: null,
    x: 2000,
    y: 2000,
    width: 160,
    height: 100,
    text: 'Distant',
    styles: {},
  },
  {
    id: 'parent',
    parentId: null,
    x: 3000,
    y: 3000,
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
    width: 120,
    height: 80,
    text: 'Child',
    styles: {},
  },
]

test('expands the visible canvas rectangle with an overscan margin', () => {
  assert.deepEqual(
    getVisibleCanvasRect({
      viewport: {
        x: 40,
        y: 80,
        width: 800,
        height: 600,
      },
      margin: 200,
    }),
    {
      x: -160,
      y: -120,
      width: 1200,
      height: 1000,
    }
  )
})

test('returns root ids that intersect the visible canvas window', () => {
  assert.deepEqual(
    getVisibleAreaIds(areas, {
      viewport: {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      },
      margin: 0,
    }),
    ['visible']
  )
})

test('keeps active areas and their ancestors mounted outside the viewport', () => {
  assert.deepEqual(
    getVisibleAreaIds(areas, {
      viewport: {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      },
      margin: 0,
      alwaysRenderAreaIds: ['child'],
    }),
    ['visible', 'parent', 'child']
  )
})

test('keeps links visible when either endpoint is still mounted', () => {
  const visibleAreaIds = new Set(['visible'])

  assert.equal(
    isAreaLinkVisible(
      {
        id: 'link-visible-distant',
        fromAreaId: 'visible',
        toAreaId: 'distant',
        kind: 'relates-to',
      },
      visibleAreaIds
    ),
    true
  )
  assert.equal(
    isAreaLinkVisible(
      {
        id: 'link-offscreen',
        fromAreaId: 'distant',
        toAreaId: 'child',
        kind: 'relates-to',
      },
      visibleAreaIds
    ),
    false
  )
})
