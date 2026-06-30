import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('app wires offscreen area indicators into the active canvas', async () => {
  const source = await readProjectFile('src/App.tsx')
  const css = await readProjectFile('src/App.css')

  assert.match(source, /getOffscreenAreaIndicators/)
  assert.match(source, /OffscreenAreaIndicators/)
  assert.match(source, /shouldShowOffscreenAreaIndicators/)
  assert.match(source, /panToOffscreenIndicator/)
  assert.match(source, /getOffscreenIndicatorAriaLabel/)
  assert.match(css, /\.offscreen-area-indicators/)
  assert.match(css, /\.offscreen-area-indicator/)
  assert.match(css, /pointer-events:\s*none;/)
  assert.match(css, /pointer-events:\s*auto;/)
})

test('offscreen indicators stay out of empty state and modal overlays', async () => {
  const source = await readProjectFile('src/App.tsx')

  assert.match(source, /!shouldShowEmptyState/)
  assert.match(source, /commandPaletteQuery === null/)
  assert.match(source, /openDialogId === null/)
  assert.match(source, /styleDialogAreaId === null/)
})

test('offscreen indicator buttons preserve zoom and do not select areas', async () => {
  const source = await readProjectFile('src/App.tsx')

  assert.match(source, /canvas\.scrollTo/)
  assert.match(source, /behavior:\s*prefersReducedMotion/)
  assert.match(source, /indicator\.targetBounds/)
  assert.doesNotMatch(source, /setSelectedAreaId\(indicator/)
})
