import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app exposes collaboration channel, presence, and profile settings UI', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /createCollaborationProfile/)
  assert.match(source, /BroadcastChannel/)
  assert.match(source, /remotePresences/)
  assert.match(source, /collaboration-presence/)
  assert.match(source, /remote-cursor/)
  assert.match(source, /remote-selection-ring/)
  assert.match(source, /Collaboration display name/)
})

test('app styles collaboration presence without blocking canvas input', async () => {
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.collaboration-presence/)
  assert.match(css, /\.remote-cursor/)
  assert.match(css, /\.remote-selection-ring/)
  assert.match(css, /\.remote-collaboration-layer[\s\S]*pointer-events:\s*none/)
})
