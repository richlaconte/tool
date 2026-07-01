import assert from 'node:assert/strict'
import test from 'node:test'

import { getCanvasPointerAction } from './canvasPointerActions.ts'

test('canvas clicks ignore read-only mode and non-canvas targets', () => {
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasWorldTarget: true,
      isReadOnly: true,
    }),
    'ignore'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasWorldTarget: false,
      isReadOnly: false,
    }),
    'ignore'
  )
})

test('canvas clicks close transient selections before creating areas', () => {
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: true,
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasWorldTarget: true,
      isReadOnly: false,
    }),
    'close-link-flyout'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasWorldTarget: true,
      isReadOnly: false,
    }),
    'deselect'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: true,
      isCanvasWorldTarget: true,
      isReadOnly: false,
    }),
    'deselect'
  )
})

test('canvas clicks create areas only when nothing is selected', () => {
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasWorldTarget: true,
      isReadOnly: false,
    }),
    'create-area'
  )
})
