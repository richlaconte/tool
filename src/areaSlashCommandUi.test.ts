import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area highlights CSS slash commands for viewers who are not editing that area', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /highlightCommandCaretIndex/)
  assert.match(
    source,
    /highlightCommandCaretIndex\s*=\s*isSelected\s*\?\s*caretIndex\s*:\s*areaText\.length/
  )
})

test('area highlights evidence slash commands and explains the target pattern', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /findEvidenceSlashCommandCandidate/)
  assert.match(source, /evidenceCommandForHighlight/)
  assert.match(source, /targetIsValid/)
  assert.match(source, /\/ref src\/App\.tsx/)
  assert.match(appSource, /\/ref src\/App\.tsx, then press Enter/)
})
