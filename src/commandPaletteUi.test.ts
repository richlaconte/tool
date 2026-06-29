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

test('command palette exposes option selection semantics', async () => {
  const source = await readFile(
    new URL('./components/CommandPalette.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /aria-controls/)
  assert.match(source, /aria-activedescendant/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /aria-selected/)
})

test('command palette restores focus after closing', async () => {
  const source = await readFile(
    new URL('./components/CommandPalette.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /previousActiveElementRef/)
  assert.match(source, /requestAnimationFrame/)
})

test('command palette options live in a typed command registry', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const registrySource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(
    appSource,
    /import \{ COMMAND_PALETTE_OPTIONS \} from '\.\/commandPaletteOptions'/
  )
  assert.doesNotMatch(appSource, /const COMMAND_PALETTE_OPTIONS/)
  assert.match(registrySource, /aliases/)
  assert.match(registrySource, /scope/)
})
