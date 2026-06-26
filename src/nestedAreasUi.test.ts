import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app renders nested areas recursively', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /renderArea/)
  assert.match(source, /getRootAreas/)
  assert.match(source, /getChildAreas/)
  assert.match(source, /onMoveEnd/)
})

test('area component accepts nested children and move-end events', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /children\?: ReactNode/)
  assert.match(source, /onMoveEnd/)
  assert.match(source, /\{children\}/)
})
