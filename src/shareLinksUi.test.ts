import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette exposes a share option and dialog controls', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(commandSource, /id: 'share'/)
  assert.match(source, /title: 'Share'/)
  assert.match(source, /Can edit/)
  assert.match(source, /Can view/)
  assert.match(source, /Copy edit link/)
  assert.match(source, /Copy view-only link/)
  assert.match(source, /Regenerate edit link/)
  assert.match(source, /Regenerate view link/)
})

test('share dialog requests server-backed links on collaborative pages', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const routeSource = await readFile(
    new URL('../app/api/pages/[pageId]/share-links/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /requestServerShareLink/)
  assert.match(source, /\/api\/pages\/\$\{page\.id\}\/share-links/)
  assert.match(routeSource, /createShareLinkMutation/)
  assert.match(routeSource, /headers\.append\('Set-Cookie'/)
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
