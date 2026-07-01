import assert from 'node:assert/strict'
import test from 'node:test'

import { getAreaLinkEditButtonOffset } from './areaLinkControls.ts'

test('connector edit button reserves space after the visible label', () => {
  assert.equal(getAreaLinkEditButtonOffset('blocks'), 54)
  assert.equal(getAreaLinkEditButtonOffset('depends on'), 62)
  assert.equal(
    getAreaLinkEditButtonOffset('very long connector label that keeps going'),
    160
  )
})
