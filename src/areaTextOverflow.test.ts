import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import * as areaResize from './areaResize.ts'

const getVisibleAreaContentHeight = (
  areaHeight: number,
  contentHeight: number
) => {
  const fn = Reflect.get(
    areaResize,
    'getVisibleAreaContentHeight'
  )

  assert.equal(typeof fn, 'function')

  return fn(areaHeight, contentHeight)
}

test('keeps the visible content layer at least as tall as the area frame', () => {
  assert.equal(getVisibleAreaContentHeight(64, 24), 64)
})

test('expands the visible content layer when text is taller than the area frame', () => {
  assert.equal(getVisibleAreaContentHeight(32, 112), 112)
})

test('area child content uses visible overflow instead of internal scrolling', async () => {
  const css = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.area-editable\s*{[\s\S]*overflow:\s*visible;/)
  assert.doesNotMatch(css, /overflow:\s*auto;/)
  assert.doesNotMatch(css, /overflow:\s*hidden;/)
  assert.doesNotMatch(css, /overflow-y:\s*auto;/)
  assert.doesNotMatch(css, /overflow-y:\s*scroll;/)
})

test('area editing avoids native textarea scroll containers', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /contentEditable/)
  assert.doesNotMatch(source, /<textarea\b/)
})

test('the canvas owns editor scrolling', async () => {
  const css = await readFile(
    new URL('./index.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /body\s*{[\s\S]*overflow:\s*hidden;/)
  assert.match(css, /#canvas\s*{[\s\S]*overflow:\s*auto;/)
})
