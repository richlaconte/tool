import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getThemeColorContrastWarning,
  getUnresolvedThemeColorTokens,
  normalizeThemeColorToken,
  resolveThemeColorTokens,
} from './themeColors.ts'

const colors = [
  {
    id: 'color-1',
    name: 'Business Blue',
    token: 'business-blue',
    value: '#2563eb',
    createdAt: '2026-06-26T12:00:00.000Z',
    updatedAt: '2026-06-26T12:00:00.000Z',
  },
  {
    id: 'color-2',
    name: 'Brand Accent',
    token: 'brand-accent',
    value: '#f97316',
    createdAt: '2026-06-26T12:00:00.000Z',
    updatedAt: '2026-06-26T12:00:00.000Z',
  },
]

test('normalizes display names into theme color tokens', () => {
  assert.equal(normalizeThemeColorToken('Business Blue'), 'business-blue')
  assert.equal(normalizeThemeColorToken('${BusinessName}-Blue'), 'businessname-blue')
})

test('resolves whole-value theme color tokens', () => {
  assert.equal(resolveThemeColorTokens('business-blue', colors), '#2563eb')
})

test('resolves theme color tokens inside compound CSS values', () => {
  assert.equal(
    resolveThemeColorTokens('1px solid business-blue', colors),
    '1px solid #2563eb'
  )
})

test('does not replace theme token substrings inside longer words', () => {
  assert.equal(
    resolveThemeColorTokens('1px solid notbusiness-blue', colors),
    '1px solid notbusiness-blue'
  )
})

test('reports unresolved theme color-like tokens', () => {
  assert.deepEqual(
    getUnresolvedThemeColorTokens('1px solid missing-token', colors),
    ['missing-token']
  )
  assert.deepEqual(
    getUnresolvedThemeColorTokens('1px solid business-blue', colors),
    []
  )
})

test('warns when a theme color has low contrast against the page background', () => {
  assert.match(
    getThemeColorContrastWarning('#f8fafc', '#ffffff') ?? '',
    /contrast/i
  )
  assert.equal(getThemeColorContrastWarning('#111827', '#ffffff'), null)
})
