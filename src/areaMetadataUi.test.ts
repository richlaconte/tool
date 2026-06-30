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
  assert.match(source, /className="area-link-layer"/)
  assert.match(source, /className="area-link-hit-target"/)
  assert.match(source, /Schema details/)
  assert.match(source, /Delete connector/)
  assert.match(areaSource, /className="area-metadata-label"/)
  assert.match(areaSource, /aria-label="Connect area"/)
  assert.match(css, /\.area-metadata-label/)
  assert.match(css, /\.area-link-layer/)
  assert.match(css, /\.area-link-hit-target/)
  assert.match(css, /\.area-link-line--selected/)
})
