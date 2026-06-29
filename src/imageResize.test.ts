import assert from 'node:assert/strict'
import test from 'node:test'

import { resizeWithPreservedAspectRatio } from './imageResize.ts'

test('preserves image aspect ratio using the dominant resize axis', () => {
  assert.deepEqual(
    resizeWithPreservedAspectRatio({
      startWidth: 320,
      startHeight: 160,
      nextWidth: 480,
      nextHeight: 180,
    }),
    {
      width: 480,
      height: 240,
    }
  )

  assert.deepEqual(
    resizeWithPreservedAspectRatio({
      startWidth: 320,
      startHeight: 160,
      nextWidth: 340,
      nextHeight: 240,
    }),
    {
      width: 480,
      height: 240,
    }
  )
})

test('falls back to freeform resize when the starting image size is invalid', () => {
  assert.deepEqual(
    resizeWithPreservedAspectRatio({
      startWidth: 0,
      startHeight: 160,
      nextWidth: 400,
      nextHeight: 200,
    }),
    {
      width: 400,
      height: 200,
    }
  )
})
