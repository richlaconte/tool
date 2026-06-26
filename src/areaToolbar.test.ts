import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area toolbar includes an invisible hover bridge', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /className="area-toolbar-bridge"/)
  assert.match(source, /aria-hidden="true"/)
})

test('area toolbar bridge shares toolbar visibility rules', async () => {
  const css = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.area-toolbar-bridge\s*{[\s\S]*display:\s*none;/)
  assert.match(css, /\.area-toolbar-bridge\s*{[\s\S]*pointer-events:\s*auto;/)
  assert.match(
    css,
    /\.area:hover \.area-toolbar-bridge,[\s\S]*\.area:focus-within \.area-toolbar-bridge[\s\S]*display:\s*block;/
  )
})
