import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { COMMAND_PALETTE_OPTIONS } from './commandPaletteOptions.ts'

const optionIds = new Set(
  COMMAND_PALETTE_OPTIONS.map((option) => option.id)
)

test('Mermaid palette entries exist for import and export', () => {
  assert.ok(optionIds.has('import-mermaid'))
  assert.ok(optionIds.has('copy-as-mermaid'))
})

test('App wires the Mermaid import dialog, copy action, and fence conversion', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const markdownComponent = await readFile(
    new URL('./components/MarkdownContent.tsx', import.meta.url),
    'utf8'
  )
  const areaComponent = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./components/markdownContent.css', import.meta.url),
    'utf8'
  )

  // Import dialog parses and inserts through one history entry.
  assert.match(source, /parseMermaidFlowchart/)
  assert.match(source, /buildMermaidImportPlan/)
  assert.match(source, /insertMermaidGraph/)
  assert.match(source, /'import-mermaid'/)
  assert.match(source, /createImportHistoryEntry/)
  assert.match(source, /mermaidImportError/)

  // Copy as Mermaid uses the selection when multi-select is active.
  assert.match(source, /exportAreasAsMermaid/)
  assert.match(source, /selectedAreaIds\.length > 1 \? selectedAreaIds : undefined/)

  // Convert action on rendered mermaid fences, edit mode only.
  assert.match(source, /onConvertMermaid=\{convertMermaidBlock\}/)
  assert.match(areaComponent, /onConvertMermaid/)
  assert.match(areaComponent, /!isReadOnly/)
  assert.match(markdownComponent, /block\.language === 'mermaid'/)
  assert.match(markdownComponent, /Convert to Areas/)
  assert.match(css, /\.md-mermaid-convert/)
})
