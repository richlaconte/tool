import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAppKeyboardAction,
  getCanvasKeyboardAction,
  getKeyboardNudgeDelta,
  getDialogKeyboardAction,
} from './appKeyboardLogic.ts'

test('escape deselects the selected area', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'Escape',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
    }),
    'deselect-area'
  )
})

test('escape opens the command palette when no area is selected', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'Escape',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
    }),
    'open-command-palette'
  )
})

test('typing opens the command palette when no area is selected', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 's',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
    }),
    'open-command-palette'
  )
})

test('system command shortcuts open an empty command palette', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'k',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'open-empty-command-palette'
  )

  assert.equal(
    getAppKeyboardAction({
      key: 'P',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasShiftModifier: true,
      hasModifier: true,
    }),
    'open-empty-command-palette'
  )
})

test('system find shortcut opens Area search outside text editing', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'f',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'open-search-palette'
  )

  assert.equal(
    getAppKeyboardAction({
      key: 'f',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'ignore'
  )
})

test('read-only mode still allows Area search shortcut', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'f',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      isReadOnly: true,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'open-search-palette'
  )
})

test('system undo and redo shortcuts work outside text editing', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'z',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'undo'
  )

  assert.equal(
    getAppKeyboardAction({
      key: 'z',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasShiftModifier: true,
      hasModifier: true,
    }),
    'redo'
  )

  assert.equal(
    getAppKeyboardAction({
      key: 'y',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'redo'
  )
})

test('system undo and redo shortcuts stay native while editing text', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'z',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'ignore'
  )

  assert.equal(
    getAppKeyboardAction({
      key: 'y',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'ignore'
  )
})

test('read-only mode ignores command palette opening shortcuts', () => {
  const baseState = {
    hasSelectedArea: false,
    isCommandPaletteOpen: false,
    isDialogOpen: false,
    isEditableTarget: false,
    isReadOnly: true,
  }

  assert.equal(
    getAppKeyboardAction({
      ...baseState,
      key: 'Escape',
    }),
    'ignore'
  )
  assert.equal(
    getAppKeyboardAction({
      ...baseState,
      key: 's',
    }),
    'ignore'
  )
  assert.equal(
    getAppKeyboardAction({
      ...baseState,
      key: 'k',
      hasMetaOrCtrlModifier: true,
      hasModifier: true,
    }),
    'ignore'
  )
  assert.equal(
    getAppKeyboardAction({
      ...baseState,
      key: 'P',
      hasMetaOrCtrlModifier: true,
      hasShiftModifier: true,
      hasModifier: true,
    }),
    'ignore'
  )
})

test('escape closes an open command palette', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'Escape',
      hasSelectedArea: false,
      isCommandPaletteOpen: true,
      isDialogOpen: false,
      isEditableTarget: false,
    }),
    'close-command-palette'
  )
})

test('does not reopen the command palette from palette escape events', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'Escape',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
      isCommandPaletteTarget: true,
    }),
    'ignore'
  )
})

test('ignores app keyboard shortcuts while a dialog is open', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'Escape',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: true,
      isEditableTarget: false,
    }),
    'ignore'
  )
})

test('enter closes an open dialog', () => {
  assert.equal(
    getDialogKeyboardAction({
      key: 'Enter',
      isCommandPaletteTarget: false,
    }),
    'close-dialog'
  )
})

test('enter from the command palette does not close the opened dialog', () => {
  assert.equal(
    getDialogKeyboardAction({
      key: 'Enter',
      isCommandPaletteTarget: true,
    }),
    'ignore'
  )
})

test('meta+a selects all areas outside text editing', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'a',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
      hasMetaOrCtrlModifier: true,
    }),
    'select-all-areas'
  )
})

test('meta+a inside a text editor stays native', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'a',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
      hasMetaOrCtrlModifier: true,
    }),
    'ignore'
  )
})

test('canvas keyboard action nudges and resizes selected areas outside text editing', () => {
  assert.equal(
    getCanvasKeyboardAction({
      key: 'ArrowRight',
      hasSelectedArea: true,
      isEditableTarget: false,
    }),
    'nudge-right'
  )
  assert.equal(
    getCanvasKeyboardAction({
      key: 'ArrowDown',
      hasSelectedArea: true,
      isEditableTarget: false,
      hasAltModifier: true,
    }),
    'resize-down'
  )
  assert.equal(
    getCanvasKeyboardAction({
      key: 'ArrowLeft',
      hasSelectedArea: true,
      isEditableTarget: true,
    }),
    'ignore'
  )
})

test('keyboard nudge delta follows snap grid and shift multiplier', () => {
  assert.equal(getKeyboardNudgeDelta({}), 1)
  assert.equal(getKeyboardNudgeDelta({ hasShiftModifier: true }), 10)
  assert.equal(
    getKeyboardNudgeDelta({ activeSnapGridSize: 16 }),
    16
  )
  assert.equal(
    getKeyboardNudgeDelta({
      activeSnapGridSize: 16,
      hasShiftModifier: true,
    }),
    64
  )
})

test('question mark opens keyboard shortcuts only outside text editing', () => {
  assert.equal(
    getAppKeyboardAction({
      key: '?',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
    }),
    'open-keyboard-shortcuts'
  )
  assert.equal(
    getAppKeyboardAction({
      key: '?',
      hasSelectedArea: true,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: true,
    }),
    'ignore'
  )
})

test('plain a without modifier still opens the command palette', () => {
  assert.equal(
    getAppKeyboardAction({
      key: 'a',
      hasSelectedArea: false,
      isCommandPaletteOpen: false,
      isDialogOpen: false,
      isEditableTarget: false,
    }),
    'open-command-palette'
  )
})
