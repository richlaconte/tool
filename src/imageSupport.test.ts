import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findImageSlashCommand,
  getImageFileValidationError,
  getImageUrlValidationError,
  removeImageSlashCommand,
} from './imageSupport.ts'

test('finds an image slash command without a URL', () => {
  const command = findImageSlashCommand('/image', 6)

  assert.deepEqual(command, {
    start: 0,
    end: 6,
    raw: '/image',
    url: '',
  })
})

test('finds an image slash command with a URL', () => {
  const command = findImageSlashCommand(
    'before /image https://example.com/photo.png',
    18
  )

  assert.equal(command?.start, 7)
  assert.equal(command?.raw, '/image https://example.com/photo.png')
  assert.equal(command?.url, 'https://example.com/photo.png')
})

test('removes a committed image slash command', () => {
  const text = 'hello /image data:image/png;base64,x'
  const command = findImageSlashCommand(text, text.length)

  assert.ok(command)

  const result = removeImageSlashCommand(text, command)

  assert.equal(result.text, 'hello ')
  assert.equal(result.caretIndex, 6)
})

test('validates image URLs conservatively', () => {
  assert.equal(getImageUrlValidationError('https://example.com/a.png'), null)
  assert.equal(getImageUrlValidationError('data:image/png;base64,abc'), null)
  assert.match(
    getImageUrlValidationError('javascript:alert(1)') ?? '',
    /URL/
  )
})

test('validates supported image files and size', () => {
  assert.equal(
    getImageFileValidationError({
      size: 1024,
      type: 'image/png',
    }),
    null
  )
  assert.match(
    getImageFileValidationError({
      size: 1024,
      type: 'image/svg+xml',
    }) ?? '',
    /PNG/
  )
  assert.match(
    getImageFileValidationError({
      size: 8 * 1024 * 1024,
      type: 'image/png',
    }) ?? '',
    /smaller/
  )
})
