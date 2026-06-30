import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAreaShellZIndex,
  SELECTED_AREA_Z_INDEX,
  UNSELECTED_AREA_Z_INDEX,
} from './areaLayering.ts'

test('selected areas render above unselected areas', () => {
  assert.equal(getAreaShellZIndex(true), SELECTED_AREA_Z_INDEX)
  assert.ok(
    getAreaShellZIndex(true) > getAreaShellZIndex(false)
  )
})

test('unselected areas use the base canvas layer', () => {
  assert.equal(getAreaShellZIndex(false), UNSELECTED_AREA_Z_INDEX)
})

test('nested child areas render above their parent controls', () => {
  assert.ok(getAreaShellZIndex(false, 1) > getAreaShellZIndex(false, 0))
  assert.ok(getAreaShellZIndex(true, 1) > getAreaShellZIndex(true, 0))
})
