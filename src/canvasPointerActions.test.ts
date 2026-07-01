import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getCanvasPointerAction,
  isBlankCanvasPointerSurface,
} from './canvasPointerActions.ts'

test('blank canvas pointer surfaces include the scroll wrapper and world', () => {
  assert.equal(isBlankCanvasPointerSurface('canvas', ''), true)
  assert.equal(
    isBlankCanvasPointerSurface('', 'canvas-scroll-size'),
    true
  )
  assert.equal(isBlankCanvasPointerSurface('', 'canvas-world'), true)
  assert.equal(
    isBlankCanvasPointerSurface(
      '',
      'canvas-world canvas--grid-visible'
    ),
    true
  )
  assert.equal(isBlankCanvasPointerSurface('', 'area-shell'), false)
  assert.equal(isBlankCanvasPointerSurface('', 'site-brand'), false)
})

test('canvas clicks ignore read-only mode and non-canvas targets', () => {
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: true,
      isReadOnly: true,
    }),
    'ignore'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: false,
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
      isCanvasSurfaceTarget: true,
      isReadOnly: false,
    }),
    'close-link-flyout'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: true,
      isReadOnly: false,
    }),
    'deselect'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: false,
      hasSelectedLink: true,
      isCanvasSurfaceTarget: true,
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
      isCanvasSurfaceTarget: true,
      isReadOnly: false,
    }),
    'create-area'
  )
})

test('canvas deselect blurs the active editor before clearing selection', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const blockStart = source.indexOf("if (action === 'deselect') {")
  const blockEnd = source.indexOf('      setHasClickedCanvas(true)', blockStart)
  const deselectBlock = source.slice(blockStart, blockEnd)

  assert.ok(blockStart > 0)
  assert.ok(blockEnd > blockStart)
  assert.match(deselectBlock, /document\.activeElement\.blur\(\)/)
  assert.match(deselectBlock, /setSelectedAreaId\(null\)/)
  assert.ok(
    deselectBlock.indexOf('document.activeElement.blur()') <
      deselectBlock.indexOf('setSelectedAreaId(null)')
  )
})
