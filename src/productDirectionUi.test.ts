import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('README opens with the canonical Cascadery positioning', async () => {
  const readme = await readProjectFile('README.md')

  assert.match(
    readme,
    /Cascadery is a CSS-native context canvas for developers and coding agents\./
  )
  assert.match(readme, /Who this is for/)
  assert.match(readme, /What it is not/)
})

test('empty state and help copy explain context canvas, CSS, and agents', async () => {
  const source = await readProjectFile('src/App.tsx')

  assert.match(source, /Map implementation context\./)
  assert.match(source, /Click anywhere to start, or choose a context kit\./)
  assert.match(source, /Map implementation context\. Style it with CSS\. Hand it to agents safely\./)
  assert.match(source, /context kit/)
  assert.match(source, /agent handoff/i)
})

test('command palette exposes context kit, evidence, and handoff actions', async () => {
  const registry = await readProjectFile('src/commandPaletteOptions.ts')

  assert.match(registry, /id: 'insert-context-kit'/)
  assert.match(registry, /id: 'add-evidence'/)
  assert.match(registry, /id: 'agent-handoff'/)
})
