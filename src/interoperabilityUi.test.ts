import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('export controls expose Markdown and JSON Canvas downloads', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /exportPageMarkdown/)
  assert.match(source, /exportPageJsonCanvas/)
  assert.match(source, /Export Markdown/)
  assert.match(source, /Export Canvas/)
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
