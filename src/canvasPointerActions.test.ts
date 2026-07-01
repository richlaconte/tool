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
      hasSelectedArea: false,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: true,
      isReadOnly: false,
    }),
    'close-link-flyout'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: true,
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: true,
      isInsideSelectedArea: false,
      isReadOnly: false,
    }),
    'deselect'
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
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: false,
      isInsideSelectedArea: false,
      isReadOnly: false,
    }),
    'deselect'
  )
  assert.equal(
    getCanvasPointerAction({
      hasLinkFlyout: false,
      hasSelectedArea: true,
      hasSelectedLink: false,
      isCanvasSurfaceTarget: true,
      isInsideSelectedArea: true,
      isReadOnly: false,
    }),
    'ignore'
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

test('canvas deselect uses the same shared routine as Escape', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const helperStart = source.indexOf('const deselectCurrentArea = useCallback')
  const helperEnd = source.indexOf('  const gifSearchProvider', helperStart)
  const helperBlock = source.slice(helperStart, helperEnd)
  const blockStart = source.indexOf("if (action === 'deselect') {")
  const blockEnd = source.indexOf('      setHasClickedCanvas(true)', blockStart)
  const deselectBlock = source.slice(blockStart, blockEnd)
  const escapeStart = source.indexOf(
    "if (keyboardAction === 'deselect-area') {"
  )
  const escapeEnd = source.indexOf(
    "      if (keyboardAction === 'close-command-palette')",
    escapeStart
  )
  const escapeBlock = source.slice(escapeStart, escapeEnd)

  assert.ok(helperStart > 0)
  assert.ok(helperEnd > helperStart)
  assert.ok(blockStart > 0)
  assert.ok(blockEnd > blockStart)
  assert.ok(escapeStart > 0)
  assert.ok(escapeEnd > escapeStart)
  assert.match(helperBlock, /document\.activeElement\.blur\(\)/)
  assert.match(helperBlock, /setSelectedAreaId\(null\)/)
  assert.match(helperBlock, /setStyleDialogAreaId\(null\)/)
  assert.match(deselectBlock, /deselectCurrentArea\(\)/)
  assert.match(escapeBlock, /deselectCurrentArea\(\)/)
  assert.ok(
    helperBlock.indexOf('document.activeElement.blur()') <
      helperBlock.indexOf('setSelectedAreaId(null)')
  )
})

test('app listens for outside-area pointer downs before area handlers stop propagation', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /closest<HTMLElement>\('\[data-area-id\]'\)/)
  assert.match(
    source,
    /document\.addEventListener\('pointerdown', handleClick, true\)/
  )
  assert.match(
    source,
    /document\.removeEventListener\('pointerdown', handleClick, true\)/
  )
  assert.match(areaSource, /data-area-id=\{area\.id\}/)
})
