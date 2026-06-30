import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterStyleProperties,
  getBrowserCssProperties,
  getStylePropertyDefinitions,
  getStyleValueSuggestions,
  normalizeStyleValueInput,
  validateStyleDeclaration,
} from './cssStyleCatalog.ts'

const themeColor = {
  id: 'theme-color-1',
  name: 'Brand Blue',
  token: 'brand-blue',
  value: '#2563eb',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
}

test('discovers kebab-case CSS properties while hiding vendor-prefixed entries', () => {
  const names = [
    'backgroundColor',
    'borderRadius',
    'WebkitLineClamp',
    'cssFloat',
    'font-size',
  ]
  const style = {
    length: names.length,
    item: (index: number) => names[index],
  } as CSSStyleDeclaration

  assert.deepEqual(getBrowserCssProperties(style), [
    'background-color',
    'border-radius',
    'float',
    'font-size',
  ])
})

test('filters properties by CSS name, label, alias, and category', () => {
  const definitions = getStylePropertyDefinitions([
    'border-radius',
    'font-size',
    'line-height',
  ])

  assert.deepEqual(
    filterStyleProperties(definitions, 'corner').map(
      (definition) => definition.property
    ),
    ['border-radius']
  )
  assert.deepEqual(
    filterStyleProperties(definitions, 'text size').map(
      (definition) => definition.property
    ),
    ['font-size']
  )
  assert.ok(
    filterStyleProperties(definitions, 'typography')
      .map((definition) => definition.property)
      .includes('line-height')
  )
})

test('normalizes semicolon-terminated CSS values', () => {
  assert.equal(
    normalizeStyleValueInput(' 1px solid currentColor; '),
    '1px solid currentColor'
  )
})

test('validates declarations and rejects incomplete border values', () => {
  const supports = (property: string, value: string) =>
    property === 'border' &&
    (value === '1px solid red' || value === 'red')

  assert.deepEqual(
    validateStyleDeclaration('border', '1px solid red', supports),
    { isValid: true, value: '1px solid red' }
  )
  assert.deepEqual(
    validateStyleDeclaration('border', 'red', supports),
    {
      isValid: false,
      value: 'red',
      message: 'Border needs width, style, and color.',
    }
  )
})

test('suggests theme colors and current values for color-like properties', () => {
  const suggestions = getStyleValueSuggestions('color', {
    activeStyles: {
      color: '#111827',
    },
    themeColors: [themeColor],
  })

  assert.deepEqual(
    suggestions.slice(0, 2).map((suggestion) => suggestion.value),
    ['#111827', 'brand-blue']
  )
  assert.ok(
    suggestions.some(
      (suggestion) =>
        suggestion.source === 'theme' &&
        suggestion.label === 'Brand Blue'
    )
  )
})
