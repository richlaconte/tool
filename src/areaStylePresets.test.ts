import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AREA_STYLE_GROUPS,
  AREA_STYLE_PRESETS,
  getAreaStyleGroupIdForProperty,
  groupActiveAreaStyles,
  searchAreaStylePresets,
} from './areaStylePresets.ts'

test('defines stable quick style groups for visual editing', () => {
  assert.deepEqual(
    AREA_STYLE_GROUPS.map((group) => group.id),
    [
      'fill',
      'text',
      'border',
      'corners',
      'shadow',
      'spacing',
      'size',
      'layout',
      'other',
    ]
  )
  assert.deepEqual(
    AREA_STYLE_GROUPS.slice(0, 6).map((group) => group.label),
    ['Fill', 'Text', 'Border', 'Corners', 'Shadow', 'Spacing']
  )
})

test('quick style presets are searchable by friendly text and CSS details', () => {
  const roundedResults = searchAreaStylePresets('rounded')
  const borderResults = searchAreaStylePresets('border-radius')

  assert.equal(
    roundedResults.some((preset) => preset.id === 'corners-rounded'),
    true
  )
  assert.equal(
    borderResults.some((preset) => preset.id === 'corners-rounded'),
    true
  )
  assert.deepEqual(
    AREA_STYLE_PRESETS.find((preset) => preset.id === 'border-subtle')
      ?.declarations,
    {
      border: '1px solid #d1d5db',
    }
  )
})

test('maps active CSS declarations into user-facing style groups', () => {
  assert.equal(getAreaStyleGroupIdForProperty('background-color'), 'fill')
  assert.equal(getAreaStyleGroupIdForProperty('font-size'), 'text')
  assert.equal(getAreaStyleGroupIdForProperty('border'), 'border')
  assert.equal(getAreaStyleGroupIdForProperty('border-radius'), 'corners')
  assert.equal(getAreaStyleGroupIdForProperty('box-shadow'), 'shadow')
  assert.equal(getAreaStyleGroupIdForProperty('padding'), 'spacing')
  assert.equal(getAreaStyleGroupIdForProperty('width'), 'size')
  assert.equal(getAreaStyleGroupIdForProperty('display'), 'layout')
  assert.equal(getAreaStyleGroupIdForProperty('scroll-margin'), 'other')
})

test('groups active Area styles while preserving unknown declarations', () => {
  const groups = groupActiveAreaStyles({
    'background-color': '#f8fafc',
    color: '#111827',
    'border-radius': '12px',
    'scroll-margin': '8px',
  })

  assert.deepEqual(
    groups
      .filter((group) => group.styles.length > 0)
      .map((group) => ({
        id: group.group.id,
        properties: group.styles.map((style) => style.property),
      })),
    [
      {
        id: 'fill',
        properties: ['background-color'],
      },
      {
        id: 'text',
        properties: ['color'],
      },
      {
        id: 'corners',
        properties: ['border-radius'],
      },
      {
        id: 'other',
        properties: ['scroll-margin'],
      },
    ]
  )
})
