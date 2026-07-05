import assert from 'node:assert/strict'
import test from 'node:test'

import {
  KEYBOARD_SHORTCUTS,
  getKeyboardShortcutForCommand,
} from './keyboardShortcuts.ts'

test('keyboard shortcuts include visible palette counterparts', () => {
  assert.ok(KEYBOARD_SHORTCUTS.length >= 8)

  for (const shortcut of KEYBOARD_SHORTCUTS) {
    assert.ok(shortcut.combo)
    assert.ok(shortcut.description)
    assert.ok(shortcut.paletteAction)
  }
})

test('keyboard shortcut data maps command ids used by the palette', () => {
  assert.equal(getKeyboardShortcutForCommand('search-areas'), 'Cmd/Ctrl+F')
  assert.equal(getKeyboardShortcutForCommand('help'), '?')
  assert.equal(getKeyboardShortcutForCommand('zoom-to-fit'), 'Shift+1')
})
