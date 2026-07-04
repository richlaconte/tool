import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Area evidence chips expose expandable code previews and drift badges', async () => {
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')

  assert.match(areaSource, /parseCodeReference/)
  assert.match(areaSource, /\/api\/code-snippet\?url=/)
  assert.match(areaSource, /ref may drift/)
  assert.match(areaSource, /highlightCode/)
  assert.match(areaSource, /area-evidence-snippet/)
  assert.match(css, /\.area-evidence-snippet/)
  assert.match(css, /\.area-evidence-drift/)
})
