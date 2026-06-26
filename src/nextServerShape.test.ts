import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readWorkspaceFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('custom server prepares Next and handles WebSocket upgrades', async () => {
  const source = await readWorkspaceFile('server.ts')

  assert.match(source, /next\(/)
  assert.match(source, /createServer/)
  assert.match(source, /server\.on\('upgrade'/)
  assert.match(source, /\/collaboration/)
})

test('custom server lets Next parse HTTP request URLs without deprecated node:url parsing', async () => {
  const source = await readWorkspaceFile('server.ts')

  assert.doesNotMatch(source, /node:url/)
  assert.doesNotMatch(source, /\bparse\(/)
  assert.match(source, /await handle\(request, response\)/)
})

test('page route renders the editor client component', async () => {
  const pageSource = await readWorkspaceFile('app/p/[pageId]/page.tsx')
  const editorSource = await readWorkspaceFile('app/p/[pageId]/EditorPage.tsx')

  assert.match(pageSource, /EditorPage/)
  assert.match(editorSource, /'use client'/)
  assert.match(editorSource, /<App/)
})
