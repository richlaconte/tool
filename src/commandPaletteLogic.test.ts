import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findExactCommandOption,
  getFilteredCommandOptions,
  getNextCommandOptionIndex,
} from './commandPaletteLogic.ts'

const options = [
  {
    id: 'help',
    title: 'Help',
    description: 'Show keyboard shortcuts and editing tips',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Open editor preferences',
    aliases: ['preferences', 'configure editor'],
  },
  {
    id: 'page-styles',
    title: 'Page styles',
    description: 'Manage page-wide appearance',
  },
]

test('filters command options by title and description', () => {
  assert.deepEqual(
    getFilteredCommandOptions(options, 'page').map(
      (option) => option.id
    ),
    ['page-styles']
  )
})

test('filters command options by alias text', () => {
  assert.deepEqual(
    getFilteredCommandOptions(options, 'configure').map(
      (option) => option.id
    ),
    ['settings']
  )
})

test('finds an exact command option by visible title', () => {
  assert.equal(
    findExactCommandOption(options, 'settings')?.id,
    'settings'
  )
})

test('finds an exact command option by alias', () => {
  assert.equal(
    findExactCommandOption(options, 'configure editor')?.id,
    'settings'
  )
})

test('wraps command option selection through visible options', () => {
  assert.equal(getNextCommandOptionIndex(0, 1, 3), 1)
  assert.equal(getNextCommandOptionIndex(2, 1, 3), 0)
  assert.equal(getNextCommandOptionIndex(0, -1, 3), 2)
})

test('returns zero selection when there are no visible options', () => {
  assert.equal(getNextCommandOptionIndex(3, 1, 0), 0)
})
