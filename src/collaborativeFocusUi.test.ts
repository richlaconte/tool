import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area auto-focus is tracked locally instead of using the shared newest area', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /autoFocusAreaId/)
  assert.doesNotMatch(source, /areas\.at\(-1\)\?\.id/)
})
