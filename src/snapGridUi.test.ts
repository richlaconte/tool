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

test('page chrome exposes enabled MCP status with client scopes', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(source, /page\.settings\.mcp\.enabled/)
  assert.match(source, /className="mcp-status-badge"/)
  assert.match(source, /MCP exposed/)
  assert.match(source, /Disable MCP access for/)
  assert.match(source, /updateMcpAccess\(false\)/)
  assert.match(source, /No-auth MCP client/)
  assert.match(source, /page:read/)
  assert.match(source, /page:search/)
  assert.match(source, /page:suggest/)
  assert.match(css, /\.mcp-status-badge/)
})

test('canvas has a visible grid state', async () => {
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.canvas--grid-visible/)
  assert.match(css, /--snap-grid-size/)
})
