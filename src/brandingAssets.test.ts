import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('site metadata points browsers to the Cascadery favicon, logo, and manifest', async () => {
  const layout = await readProjectFile('app/layout.tsx')
  const index = await readProjectFile('index.html')

  assert.match(layout, /title:\s*'Cascadery'/)
  assert.match(layout, /applicationName:\s*'Cascadery'/)
  assert.match(layout, /manifest:\s*'\/manifest\.webmanifest'/)
  assert.match(layout, /icons:/)
  assert.match(layout, /icon:\s*'\/favicon\.svg'/)
  assert.match(layout, /shortcut:\s*'\/favicon\.svg'/)
  assert.match(layout, /apple:\s*'\/logo\.svg'/)
  assert.match(index, /<title>Cascadery<\/title>/)
  assert.match(index, /rel="manifest"/)
})

test('editor renders a lightweight site brand mark from the logo asset', async () => {
  const appSource = await readProjectFile('src/App.tsx')
  const appStyles = await readProjectFile('src/App.css')

  assert.match(appSource, /<button\s+className="site-brand"/)
  assert.match(appSource, /aria-label="Open Cascadery menu"/)
  assert.match(appSource, /onClick=\{handleBrandClick\}/)
  assert.match(appSource, /const handleBrandClick = \(\) =>/)
  assert.match(appSource, /setOpenDialogId\('leave-canvas'\)/)
  assert.match(appSource, /<span>cascadery<\/span>/)
  assert.match(appSource, /src="\/logo\.svg"/)
  assert.match(appStyles, /\.site-brand/)
})

test('brand click confirmation can return the user to the empty start screen', async () => {
  const appSource = await readProjectFile('src/App.tsx')

  assert.match(appSource, /'leave-canvas':/)
  assert.match(appSource, /Are you sure you want to leave\?/)
  assert.match(appSource, /No, stay/)
  assert.match(appSource, /Yes, leave/)
  assert.match(appSource, /const leaveCanvasForStart = \(\) =>/)
  assert.match(appSource, /window\.history\.pushState\(\{\}, '', '\/'\)/)
  assert.match(appSource, /setHasClickedCanvas\(false\)/)
})

test('favicon, logo, and manifest use the Cascadery brand assets', async () => {
  const favicon = await readProjectFile('public/favicon.svg')
  const logo = await readProjectFile('public/logo.svg')
  const manifest = await readProjectFile('public/manifest.webmanifest')
  const mark = await readProjectFile('public/brand/cascadery-mark.svg')
  const wordmark = await readProjectFile('public/brand/cascadery-wordmark.svg')

  assert.match(favicon, /aria-label="Cascadery"/)
  assert.match(logo, /aria-label="Cascadery"/)
  assert.match(favicon, /#4F46E5/)
  assert.match(logo, /#06B6D4/)
  assert.match(manifest, /"name":\s*"Cascadery"/)
  assert.match(manifest, /"src":\s*"\/logo\.svg"/)
  assert.match(mark, /aria-label="Cascadery"/)
  assert.match(wordmark, /aria-label="Cascadery"/)
})
