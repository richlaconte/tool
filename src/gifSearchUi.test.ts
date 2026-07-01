import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('command palette and app expose gif search entry points', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )
  const css = await readFile(new URL('./App.css', import.meta.url), 'utf8')

  assert.match(commandSource, /id: 'insert-gif'/)
  assert.match(commandSource, /giphy/)
  assert.match(appSource, /GifSearchFlyout/)
  assert.match(appSource, /giphyApiKey/)
  assert.match(appSource, /readGiphyApiKey/)
  assert.match(appSource, /Powered by GIPHY/)
  assert.match(appSource, /insertGifResult/)
  assert.match(css, /\.gif-search-flyout/)
  assert.match(css, /overflow: hidden/)
})

test('area handles gif slash commands before image and css commands', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /findGifSlashCommand/)
  assert.match(source, /onGifCommandActive/)
  assert.match(source, /activeGifCommand/)
  assert.match(source, /prefers-reduced-motion/)
  assert.match(source, /Pause GIF/)
  assert.match(source, /!activeGifCommand[\s\S]*findImageSlashCommand/)
})

test('asset source metadata persists and exports without provider secrets', async () => {
  const persistenceSource = await readFile(
    new URL('./pagePersistence.ts', import.meta.url),
    'utf8'
  )
  const exportSource = await readFile(
    new URL('./pageExports.ts', import.meta.url),
    'utf8'
  )
  const agentSource = await readFile(
    new URL('./agentInterface.ts', import.meta.url),
    'utf8'
  )

  assert.match(persistenceSource, /parseGifAssetSource/)
  assert.match(exportSource, /source: asset\.source/)
  assert.doesNotMatch(exportSource, /VITE_GIPHY_API_KEY/)
  assert.match(agentSource, /source/)
})
