import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findCssSlashCommand,
  removeCssSlashCommand,
} from './cssSlashCommand.ts'

const supports = (property: string, value: string) =>
  (property === 'background-color' &&
    (value === 'initial' || value === 'red')) ||
  (property === 'border' &&
    (value === 'initial' ||
      value === 'red' ||
      value === 'solid red' ||
      value === '1px solid red'))

test('finds a valid slash command with a space separated value', () => {
  const text = '/background-color red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.deepEqual(command, {
    start: 0,
    end: text.length,
    raw: text,
    property: 'background-color',
    value: 'red',
    propertyIsValid: true,
    declarationIsValid: true,
  })
})

test('finds a valid slash command with a colon separated value', () => {
  const text = '/background-color: red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.property, 'background-color')
  assert.equal(command?.value, 'red')
  assert.equal(command?.declarationIsValid, true)
})

test('allows a slash command value to end in a semicolon', () => {
  const text = '/border: 1px solid red;'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.property, 'border')
  assert.equal(command?.value, '1px solid red')
  assert.equal(command?.raw, text)
  assert.equal(command?.declarationIsValid, true)
})

test('treats color-only border shorthand values as incomplete', () => {
  const text = '/border red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.propertyIsValid, true)
  assert.equal(command?.declarationIsValid, false)
})

test('allows visible border shorthand values without an explicit width', () => {
  const text = '/border solid red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.propertyIsValid, true)
  assert.equal(command?.declarationIsValid, true)
})

test('reports valid properties before a valid value is present', () => {
  const text = '/background-color'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.propertyIsValid, true)
  assert.equal(command?.declarationIsValid, false)
})

test('ignores invalid properties', () => {
  const text = '/fake-property red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.equal(command?.propertyIsValid, false)
  assert.equal(command?.declarationIsValid, false)
})

test('removes committed command text and returns the caret to the command start', () => {
  const text = 'hello\n/background-color red'
  const command = findCssSlashCommand(text, text.length, supports)

  assert.ok(command)
  assert.deepEqual(removeCssSlashCommand(text, command), {
    text: 'hello\n',
    caretIndex: 6,
  })
})
