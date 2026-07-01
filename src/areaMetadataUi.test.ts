import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette exposes area metadata and link actions', async () => {
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(commandSource, /id: 'set-area-type'/)
  assert.match(commandSource, /id: 'link-selected-area'/)
})

test('app renders area metadata controls and connector lines', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')

  assert.match(source, /openDialogId === 'set-area-type'/)
  assert.match(source, /openDialogId === 'link-selected-area'/)
  assert.match(source, /openDialogId === 'edit-area-link'/)
  assert.match(source, /className="area-link-flyout"/)
  assert.match(source, /className="area-link-layer"/)
  assert.match(source, /className="area-link-hit-target"/)
  assert.match(source, /className="area-link-preview-line"/)
  assert.match(source, /className="area-link-endpoint-handle"/)
  assert.match(source, /Schema details/)
  assert.match(source, /Delete connector/)
  assert.doesNotMatch(areaSource, /className="area-metadata-label"/)
  assert.match(areaSource, /aria-label="Connect area"/)
  assert.match(areaSource, /area-link-zone/)
  assert.match(areaSource, /onBeginLinkDrag/)
  assert.doesNotMatch(css, /\.area-metadata-label/)
  assert.match(css, /\.area-link-flyout/)
  assert.match(css, /\.area-link-preview-line/)
  assert.match(css, /\.area-link-endpoint-handle/)
  assert.match(css, /\.area-link-layer/)
  assert.match(css, /\.area-link-hit-target/)
  assert.match(css, /\.area-link-line--selected/)
})

test('selected connector exposes explicit edit controls instead of auto-opening the flyout', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')

  assert.match(source, /linkFlyoutLinkId/)
  assert.match(source, /area-link-edit-button/)
  assert.match(source, /aria-label="Edit connector"/)
  assert.match(source, /aria-label="Close connector menu"/)
  assert.match(source, /getAreaLinkEditButtonOffset/)
  assert.match(source, /--area-link-label-offset/)
  const flyoutIndex = source.indexOf('className="area-link-flyout"')
  const flyoutGuard = source.slice(Math.max(0, flyoutIndex - 500), flyoutIndex)

  assert.notEqual(flyoutIndex, -1)
  assert.match(flyoutGuard, /linkFlyoutLinkId === selectedLink\.id/)
  assert.match(flyoutGuard, /openDialogId === null/)
  assert.match(css, /\.area-link-edit-button/)
  assert.match(css, /translate\(var\(--area-link-label-offset\), -50%\)/)
  assert.match(css, /\.area-link-flyout-header/)
  assert.match(css, /\.area-link-flyout-close/)
})

test('selected connector endpoint handles render above Area edge link zones', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')
  const areaCss = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )
  const areaRenderIndex = source.indexOf('{getRootAreas(areas).map(renderArea)}')
  const controlLayerIndex = source.indexOf('className="area-link-control-layer"')

  assert.notEqual(areaRenderIndex, -1)
  assert.notEqual(controlLayerIndex, -1)
  assert.ok(controlLayerIndex > areaRenderIndex)
  assert.match(css, /\.area-link-control-layer/)
  assert.match(css, /\.area-link-control-layer[\s\S]*z-index: 62/)
  assert.match(areaCss, /\.area-link-zone[\s\S]*z-index: 1/)
})

test('app renders nesting preview states for child Area drops', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /nestingPreview/)
  assert.match(source, /getCandidateParentId/)
  assert.match(areaSource, /area--nesting-target/)
  assert.match(areaSource, /area--unnesting-source/)
  assert.match(css, /\.area--nesting-target/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(commandSource, /id: 'nest-selected-area'/)
  assert.match(commandSource, /id: 'unnest-selected-area'/)
  assert.match(commandSource, /id: 'add-child-area'/)
})
