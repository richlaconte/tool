import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('page styles exposes theme color controls', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /Theme colors/)
  assert.match(source, /aria-label="Theme color name"/)
  assert.match(source, /aria-label="Theme color token"/)
  assert.match(source, /aria-label="Theme color value"/)
  assert.match(source, /Add color/)
})

test('app renders theme color swatches while styling', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(source, /theme-color-swatches/)
  assert.match(css, /\.theme-color-swatches/)
})
