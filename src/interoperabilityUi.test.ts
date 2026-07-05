import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('export controls expose Markdown and JSON Canvas downloads', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /exportPageMarkdown/)
  assert.match(source, /exportPageJsonCanvas/)
  assert.match(source, /Export Markdown/)
  assert.match(source, /Export Canvas/)
  assert.match(source, /may not survive editing in other apps/)
})

test('import control accepts Cascadery JSON and JSON Canvas files', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /parseJsonCanvas/)
  assert.match(source, /JSON Canvas import warnings/)
  assert.match(source, /Import anyway\?/)
  assert.match(source, /accept="application\/json,application\/vnd\.jsoncanvas\+json,\.json,\.canvas"/)
  assert.match(source, /Import JSON or Canvas/)
})

test('MCP gateway exposes Markdown and JSON Canvas resources', async () => {
  const source = await readFile(
    new URL('./mcpGateway.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /\/markdown/)
  assert.match(source, /\/json-canvas/)
  assert.match(source, /MARKDOWN_MIME_TYPE/)
  assert.match(source, /JSON_CANVAS_MIME_TYPE/)
})
