import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette scrolls the selected overflow option into view', async () => {
  const source = await readFile(
    new URL('./components/CommandPalette.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /selectedOptionRefs/)
  assert.match(source, /scrollIntoView/)
  assert.match(source, /block: 'nearest'/)
})
