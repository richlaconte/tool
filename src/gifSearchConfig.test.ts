import assert from 'node:assert/strict'
import test from 'node:test'

import { readGiphyApiKey } from './gifSearchConfig.ts'

test('reads the runtime GIPHY API key from server-safe or public env names', () => {
  assert.equal(
    readGiphyApiKey({
      GIPHY_API_KEY: 'runtime-key',
      NEXT_PUBLIC_GIPHY_API_KEY: 'public-key',
      VITE_GIPHY_API_KEY: 'vite-key',
    }),
    'runtime-key'
  )
  assert.equal(
    readGiphyApiKey({
      NEXT_PUBLIC_GIPHY_API_KEY: 'public-key',
      VITE_GIPHY_API_KEY: 'vite-key',
    }),
    'public-key'
  )
  assert.equal(
    readGiphyApiKey({
      VITE_GIPHY_API_KEY: 'vite-key',
    }),
    'vite-key'
  )
})

test('trims blank GIPHY API key values before falling back', () => {
  assert.equal(
    readGiphyApiKey({
      GIPHY_API_KEY: '   ',
      NEXT_PUBLIC_GIPHY_API_KEY: ' public-key ',
    }),
    'public-key'
  )
  assert.equal(readGiphyApiKey({ GIPHY_API_KEY: '   ' }), '')
})
