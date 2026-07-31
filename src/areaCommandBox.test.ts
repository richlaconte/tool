import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMMAND_BOX_SUGGESTIONS,
  getCommandBoxPlacement,
  getCommandBoxSuggestions,
  parseCommandBoxDraft,
} from './areaCommandBox.ts'

const VIEWPORT = { viewportHeight: 800, viewportWidth: 1200 }
const ANCHOR = { top: 300, left: 400, bottom: 460, width: 240 }
const BOX = { boxHeight: 120, boxWidth: 360 }

test('places the box above the anchor by default, left-aligned', () => {
  const placement = getCommandBoxPlacement({ anchorRect: ANCHOR, ...BOX, ...VIEWPORT })

  assert.equal(placement.side, 'above')
  assert.equal(placement.top, ANCHOR.top - BOX.boxHeight - 8)
  assert.equal(placement.left, ANCHOR.left)
})

test('flips below when the anchor is near the viewport top', () => {
  const placement = getCommandBoxPlacement({
    anchorRect: { ...ANCHOR, top: 40, bottom: 200 },
    ...BOX,
    ...VIEWPORT,
  })

  assert.equal(placement.side, 'below')
  assert.equal(placement.top, 200 + 8)
})

test('clamps below placement that would overflow the viewport bottom', () => {
  const placement = getCommandBoxPlacement({
    anchorRect: { ...ANCHOR, top: 10, bottom: 780 },
    ...BOX,
    ...VIEWPORT,
  })

  assert.equal(placement.side, 'below')
  assert.equal(placement.top, VIEWPORT.viewportHeight - BOX.boxHeight - 8)
})

test('anchors to the visible top edge when the anchor is taller than the viewport', () => {
  const placement = getCommandBoxPlacement({
    anchorRect: { ...ANCHOR, top: -600, bottom: 1400 },
    ...BOX,
    ...VIEWPORT,
  })

  assert.equal(placement.side, 'below')
  assert.equal(placement.top, VIEWPORT.viewportHeight - BOX.boxHeight - 8)
})

test('shifts horizontally to keep the box on-screen', () => {
  const rightEdge = getCommandBoxPlacement({
    anchorRect: { ...ANCHOR, left: 1100 },
    ...BOX,
    ...VIEWPORT,
  })
  const leftEdge = getCommandBoxPlacement({
    anchorRect: { ...ANCHOR, left: -50 },
    ...BOX,
    ...VIEWPORT,
  })

  assert.equal(rightEdge.left, VIEWPORT.viewportWidth - BOX.boxWidth - 8)
  assert.equal(leftEdge.left, 8)
})

test('lists all suggestions for an empty draft', () => {
  assert.equal(getCommandBoxSuggestions('').length, COMMAND_BOX_SUGGESTIONS.length)
  assert.equal(getCommandBoxSuggestions('   ').length, COMMAND_BOX_SUGGESTIONS.length)
})

test('filters suggestions by property fragment and description', () => {
  const byProperty = getCommandBoxSuggestions('bor')

  assert.deepEqual(
    byProperty.map((suggestion) => suggestion.property),
    ['border', 'border-radius']
  )

  const byDescription = getCommandBoxSuggestions('shadow')

  assert.deepEqual(
    byDescription.map((suggestion) => suggestion.property),
    ['box-shadow']
  )
})

test('hides suggestions once the draft becomes a declaration', () => {
  assert.equal(getCommandBoxSuggestions('border:').length, 0)
  assert.equal(getCommandBoxSuggestions('border 2px').length, 0)
})

test('parses a valid declaration with the inline grammar', () => {
  const command = parseCommandBoxDraft('border: 2px solid red', () => true)

  assert.ok(command)
  assert.equal(command.property, 'border')
  assert.equal(command.value, '2px solid red')
  assert.equal(command.declarationIsValid, true)
})

test('parses space-separated declarations and custom properties', () => {
  const spaced = parseCommandBoxDraft('opacity 0.5', () => true)
  const custom = parseCommandBoxDraft('--accent: blue', () => true)

  assert.equal(spaced?.property, 'opacity')
  assert.equal(spaced?.declarationIsValid, true)
  assert.equal(custom?.property, '--accent')
})

test('reports invalid properties and incomplete declarations', () => {
  const unknownProperty = parseCommandBoxDraft(
    'not-a-property: 1px',
    (property) => property === 'border'
  )
  const missingValue = parseCommandBoxDraft('border:', () => true)
  const incompleteBorder = parseCommandBoxDraft('border: 2px', () => true)
  const gibberish = parseCommandBoxDraft('???', () => true)

  assert.ok(unknownProperty)
  assert.equal(unknownProperty.propertyIsValid, false)
  assert.equal(unknownProperty.declarationIsValid, false)
  assert.equal(missingValue?.declarationIsValid, false)
  assert.equal(incompleteBorder?.declarationIsValid, false)
  assert.equal(gibberish, null)
})
