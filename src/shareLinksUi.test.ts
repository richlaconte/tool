import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette exposes a share option and dialog controls', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(source, /id: 'share'/)
  assert.match(source, /title: 'Share'/)
  assert.match(source, /Can edit/)
  assert.match(source, /Can view/)
  assert.match(source, /Copy edit link/)
  assert.match(source, /Copy view-only link/)
  assert.match(source, /Regenerate edit link/)
  assert.match(source, /Regenerate view link/)
})

test('app has explicit view-only mode affordances', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(appSource, /isViewOnly/)
  assert.match(appSource, /View only/)
  assert.match(appSource, /view-only/)
  assert.match(areaSource, /isReadOnly/)
  assert.match(areaSource, /contentEditable=\{isReadOnly/)
})
