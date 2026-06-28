import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('page styles exposes snap grid controls', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /id: 'toggle-snap-grid'/)
  assert.match(source, /aria-label="Snap to grid"/)
  assert.match(source, /aria-label="Show grid"/)
  assert.match(source, /aria-label="Grid size"/)
})

test('page styles exposes MCP access controls', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /MCP access/)
  assert.match(source, /aria-label="Allow MCP access"/)
})

test('canvas has a visible grid state', async () => {
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.canvas--grid-visible/)
  assert.match(css, /--snap-grid-size/)
})
