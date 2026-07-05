import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app wires keyboard outline and shortcut dialogs into the command system', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const registrySource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(appSource, /getCanvasKeyboardAction/)
  assert.match(appSource, /getKeyboardNudgeDelta/)
  assert.match(appSource, /getPageOutline/)
  assert.match(appSource, /KEYBOARD_SHORTCUTS/)
  assert.match(appSource, /aria-live="polite"/)
  assert.match(appSource, /openDialogId === 'page-outline'/)
  assert.match(appSource, /openDialogId === 'keyboard-shortcuts'/)
  assert.match(registrySource, /id: 'page-outline'/)
  assert.match(registrySource, /id: 'keyboard-shortcuts'/)
  assert.match(areaSource, /getAreaAccessibleLabel\(area\)/)
  assert.match(areaSource, /aria-label=\{getAreaAccessibleLabel\(area\)\}/)
})
