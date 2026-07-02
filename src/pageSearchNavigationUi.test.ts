import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const commandOptionsSource = readFileSync(
  new URL('./commandPaletteOptions.ts', import.meta.url),
  'utf8'
)
const commandPaletteSource = readFileSync(
  new URL('./components/CommandPalette.tsx', import.meta.url),
  'utf8'
)

test('command palette exposes Area search as a visible command and mode', () => {
  assert.match(commandOptionsSource, /id: 'search-areas'/)
  assert.match(commandOptionsSource, /title: 'Search Areas/)
  assert.match(appSource, /commandPaletteQuery\?\.startsWith\('\?'\)/)
  assert.match(appSource, /searchAreas\(/)
})

test('Area search results jump to and select matching Areas', () => {
  assert.match(appSource, /const jumpToArea = useCallback/)
  assert.match(appSource, /getZoomToArea/)
  assert.match(appSource, /option\.kind === 'area-search-result'/)
})

test('Area search results render metadata without command filtering', () => {
  assert.match(commandPaletteSource, /shouldFilterOptions/)
  assert.match(commandPaletteSource, /command-palette-result-badge/)
  assert.match(commandPaletteSource, /placeholder=/)
})
