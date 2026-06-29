import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAppKeyboardAction,
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
