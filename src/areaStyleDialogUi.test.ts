import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area toolbar exposes an Area styles action', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /onOpenStyles/)
  assert.match(source, /aria-label="Open Area styles"/)
  assert.match(source, /<StyleSlidersIcon \/>/)
})

test('App renders a guided Area styles dialog for the selected Area', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /AreaStyleDialog/)
  assert.match(source, /styleDialogAreaId/)
  assert.match(source, /onApplyStyle/)
  assert.match(source, /onRemoveStyle/)
  assert.match(source, /setStyleDialogAreaId\(areaId\)/)
})

test('AreaStyleDialog opens on outcome recipes before advanced CSS', async () => {
  const dialogSource = await readFile(
    new URL('./components/AreaStyleDialog.tsx', import.meta.url),
    'utf8'
  )
  const presetSource = await readFile(
    new URL('./areaStylePresets.ts', import.meta.url),
    'utf8'
  )
  const source = `${dialogSource}\n${presetSource}`

  assert.match(source, /Style Area/)
  assert.match(source, /Search styles or CSS/)
  assert.match(source, /Advanced CSS/)
  assert.match(source, /areaStylePanel/)
  assert.match(source, /areaStylePanel === 'advanced' \?/)
  assert.match(source, /AreaStyleActiveSummary/)
  assert.match(source, /AreaStyleQuickPanel/)
  assert.match(source, /AreaStyleAdvancedPanel/)
  assert.match(source, /Fill/)
  assert.match(source, /Text/)
  assert.match(source, /Border/)
  assert.match(source, /Corners/)
  assert.match(source, /Shadow/)
  assert.match(source, /Spacing/)
})

test('AreaStyleDialog keeps advanced CSS explicit and searchable', async () => {
  const source = await readFile(
    new URL('./components/AreaStyleDialog.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /Active styles/)
  assert.match(source, /Search CSS properties/)
  assert.match(source, /Browse properties/)
  assert.match(source, /shouldShowPropertyList/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /getStyleValueSuggestions/)
  assert.match(source, /validateStyleDeclaration/)
  assert.match(source, /Remove/)
  assert.doesNotMatch(source, /role="tablist"/)
  assert.doesNotMatch(source, />Quick styles</)
})

test('AreaStyleDialog uses preview-oriented style controls', async () => {
  const source = await readFile(
    new URL('./components/AreaStyleDialog.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /area-style-preset-preview/)
  assert.match(source, /area-style-suggestion-preview/)
  assert.match(source, /getPresetPreviewStyle/)
  assert.match(source, /getSuggestionPreview/)
})

test('Area styles are hidden from view-only rendering', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /shouldShowEditorChrome && styleDialogArea/)
  assert.match(source, /onOpenStyles=\{\(areaId\) =>/)
})
