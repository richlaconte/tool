import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('site metadata points browsers to the custom favicon and logo', async () => {
  const layout = await readProjectFile('app/layout.tsx')

  assert.match(layout, /icons:/)
  assert.match(layout, /icon:\s*'\/favicon\.svg'/)
  assert.match(layout, /shortcut:\s*'\/favicon\.svg'/)
  assert.match(layout, /apple:\s*'\/logo\.svg'/)
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

test('favicon and logo are custom Tool canvas marks', async () => {
  const favicon = await readProjectFile('public/favicon.svg')
  const logo = await readProjectFile('public/logo.svg')

  assert.match(favicon, /<title>Tool favicon<\/title>/)
  assert.match(logo, /<title>Tool logo<\/title>/)
  assert.match(favicon, /slash-cursor/)
  assert.match(logo, /slash-cursor/)
})
