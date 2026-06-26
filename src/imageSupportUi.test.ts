import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app exposes image insertion entry points', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /id: 'insert-image'/)
  assert.match(source, /accept="image\/png,image\/jpeg,image\/gif,image\/webp"/)
  assert.match(source, /onDrop=/)
  assert.match(source, /paste/)
})

test('area handles image slash commands before CSS commands', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /findImageSlashCommand/)
  assert.match(source, /onCommitImageCommand/)
  assert.match(source, /activeImageCommand/)
})

test('area renders image objects with accessible alt text', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /className="area-image"/)
  assert.match(source, /alt={area.alt}/)
})
