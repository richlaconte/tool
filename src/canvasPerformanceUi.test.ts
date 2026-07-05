import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('canvas rendering uses viewport culling and benchmark content tools', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const commandRegistrySource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(
    appSource,
    /import \{ getVisibleAreaIds, isAreaLinkVisible \} from '\.\/canvasCulling'/
  )
  assert.match(
    appSource,
    /import \{ createBenchmarkPageState \} from '\.\/benchmarkPage'/
  )
  assert.match(appSource, /visibleAreaIdSet/)
  assert.match(appSource, /getRootAreas\(areas\)\s*\.filter/)
  assert.match(appSource, /isAreaLinkVisible\(link, visibleAreaIdSet\)/)
  assert.match(appSource, /process\.env\.NODE_ENV === 'production'/)
  assert.match(commandRegistrySource, /id: 'insert-benchmark-content'/)
})

test('Area component is memoized for stable offscreen culling boundaries', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /memo/)
  assert.match(source, /export default memo\(Area\)/)
})
