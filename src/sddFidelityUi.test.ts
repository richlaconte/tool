import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { COMMAND_PALETTE_OPTIONS } from './commandPaletteOptions.ts'
import { EARS_TEMPLATES } from './earsLint.ts'

const optionIds = new Set(
  COMMAND_PALETTE_OPTIONS.map((option) => option.id)
)

test('SDD fidelity palette entries exist for scaffolds, export, and coverage', () => {
  assert.ok(optionIds.has('export-spec-kit-bundle'))
  assert.ok(optionIds.has('show-uncovered-requirements'))

  for (const template of EARS_TEMPLATES) {
    assert.ok(
      optionIds.has(`insert-ears-${template.id}`),
      `palette option for EARS template "${template.id}"`
    )
  }
})

test('App wires Spec Kit export, EARS scaffolds, lint hints, and coverage selection', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  // Spec Kit export dialog and zip download.
  assert.match(source, /compileSpecKitBundle/)
  assert.match(source, /createZipArchive/)
  assert.match(source, /normalizeSpecKitFeatureNumber/)
  assert.match(source, /'export-spec-kit-bundle'/)
  assert.match(source, /specKitFeatureNumber/)
  assert.match(source, /Download zip/)

  // EARS scaffolds create requirement Areas.
  assert.match(source, /insertEarsRequirement/)
  assert.match(source, /EARS_TEMPLATES/)
  assert.match(source, /kind: 'requirement'/)

  // Dismissible lint hints in the Area metadata dialog.
  assert.match(source, /lintEarsRequirement/)
  assert.match(source, /earsHintsForSelectedArea/)
  assert.match(source, /earsHintDismissed: true/)
  assert.match(source, /Dismiss hints/)
  assert.match(css, /\.ears-lint-hints/)

  // Coverage action selects uncovered requirement Areas.
  assert.match(source, /showUncoveredRequirements/)
  assert.match(source, /getSddTraceability/)
  assert.match(source, /uncoveredRequirements\.map\(\(area\) => area\.id\)/)
})
