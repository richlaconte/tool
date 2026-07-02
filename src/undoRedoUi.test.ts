import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app routes undo and redo keyboard actions through collaborative sync', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /keyboardAction === 'undo'/)
  assert.match(source, /collaborativeSync\.undo\(\)/)
  assert.match(source, /keyboardAction === 'redo'/)
  assert.match(source, /collaborativeSync\.redo\(\)/)
})

test('history dialog explains session undo versus durable history', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /Session undo is local to this tab/)
  assert.match(source, /History is durable page-level recovery/)
})
