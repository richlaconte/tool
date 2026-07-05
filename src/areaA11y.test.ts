import assert from 'node:assert/strict'
import test from 'node:test'

import { getAreaAccessibleLabel } from './areaA11y.ts'

test('composes area accessible labels from kind status and first line', () => {
  assert.equal(
    getAreaAccessibleLabel({
      id: 'area-1',
      parentId: null,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: 'Ship keyboard support\nMore detail',
      styles: {},
      metadata: {
        kind: 'task',
        status: 'in-progress',
        tags: [],
      },
    }),
    'Task, in progress: Ship keyboard support'
  )
})

test('falls back for image and empty text areas', () => {
  assert.equal(
    getAreaAccessibleLabel({
      id: 'image-1',
      type: 'image',
      parentId: null,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      assetId: 'asset-1',
      alt: 'Architecture diagram',
      styles: {},
      metadata: {
        kind: 'component',
        tags: [],
      },
    }),
    'Component: Architecture diagram'
  )
  assert.equal(
    getAreaAccessibleLabel({
      id: 'empty',
      parentId: null,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: '',
      styles: {},
    }),
    'Note: Empty Area'
  )
})

test('truncates long excerpts without splitting the label prefix', () => {
  const label = getAreaAccessibleLabel({
    id: 'long',
    parentId: null,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    text: 'A'.repeat(120),
    styles: {},
  })

  assert.equal(label.length, 'Note: '.length + 81)
  assert.ok(label.endsWith('…'))
})
