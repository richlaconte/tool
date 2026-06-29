import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette exposes a History option', async () => {
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(commandSource, /id: 'history'/)
  assert.match(commandSource, /title: 'History'/)
})

test('app records import and agent proposal changes in page history', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /createImportHistoryEntry/)
  assert.match(source, /createAgentHistoryEntry/)
  assert.match(source, /setPageHistory/)
  assert.match(source, /openDialogId === 'history'/)
})

test('history dialog lists recent changes and reversible actions', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')

  assert.match(source, /className="history-dialog"/)
  assert.match(source, /Undo patch/)
  assert.match(source, /Restore previous page/)
  assert.match(css, /\.history-dialog/)
  assert.match(css, /\.history-event/)
})
