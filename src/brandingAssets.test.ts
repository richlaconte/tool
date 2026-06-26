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
  assert.match(appSource, /aria-label="Open command palette"/)
  assert.match(appSource, /onClick=\{\(\) => setCommandPaletteQuery\(''\)\}/)
  assert.match(appSource, /<span>cascadery<\/span>/)
  assert.match(appSource, /src="\/logo\.svg"/)
  assert.match(appStyles, /\.site-brand/)
})

test('favicon and logo are custom Tool canvas marks', async () => {
  const favicon = await readProjectFile('public/favicon.svg')
  const logo = await readProjectFile('public/logo.svg')

  assert.match(favicon, /<title>Tool favicon<\/title>/)
  assert.match(logo, /<title>Tool logo<\/title>/)
  assert.match(favicon, /slash-cursor/)
  assert.match(logo, /slash-cursor/)
})
