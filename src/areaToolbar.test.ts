import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area toolbar includes an invisible hover bridge', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /className="area-toolbar-bridge"/)
  assert.match(source, /aria-hidden="true"/)
})

test('area toolbar bridge shares toolbar visibility rules', async () => {
  const css = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.area-toolbar-bridge\s*{[\s\S]*display:\s*none;/)
  assert.match(css, /\.area-toolbar-bridge\s*{[\s\S]*pointer-events:\s*auto;/)
  assert.match(
    css,
    /\.area:hover \.area-toolbar-bridge,[\s\S]*\.area:focus-within \.area-toolbar-bridge[\s\S]*display:\s*block;/
  )
})

test('area toolbar avoids native hover title tooltips', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(source, /title="Move"/)
  assert.doesNotMatch(source, /title="Connect"/)
  assert.doesNotMatch(source, /title="Duplicate"/)
  assert.doesNotMatch(source, /title="Delete"/)
  assert.doesNotMatch(source, /title="Resize"/)
  assert.doesNotMatch(source, /title="Area styles"/)
  assert.match(source, /aria-label="Move area"/)
  assert.match(source, /aria-label="Open Area styles"/)
})

test('area toolbar hides actions by available area width and keeps drag longest', async () => {
  const source = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./components/area.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.area\s*{[\s\S]*container-type:\s*inline-size;/)
  assert.match(source, /area-action-button--priority-extra/)
  assert.match(source, /area-action-button--priority-low/)
  assert.match(source, /area-action-button--priority-medium/)
  assert.match(source, /area-action-button--danger/)
  assert.match(
    css,
    /@container\s*\(max-width:\s*196px\)\s*{[\s\S]*\.area-action-button--priority-extra\s*{[\s\S]*display:\s*none;[\s\S]*}/
  )
  assert.match(
    css,
    /@container\s*\(max-width:\s*152px\)\s*{[\s\S]*\.area-action-button--priority-low\s*{[\s\S]*display:\s*none;[\s\S]*}/
  )
  assert.match(
    css,
    /@container\s*\(max-width:\s*96px\)\s*{[\s\S]*\.area-action-button--priority-medium\s*{[\s\S]*display:\s*none;[\s\S]*}/
  )
  assert.match(
    css,
    /@container\s*\(max-width:\s*60px\)\s*{[\s\S]*\.area-actions\s*{[\s\S]*display:\s*none\s*!important;[\s\S]*}/
  )
})

test('area deleted undo toast can be dismissed without undoing', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )

  assert.match(source, /aria-label="Dismiss deleted area notice"/)
  assert.match(source, /className="undo-toast-close"/)
  assert.match(source, /onClick=\{\(\) => setDeletedAreaSnapshot\(null\)\}/)
  assert.match(css, /\.undo-toast-close\s*{[\s\S]*width:\s*28px;/)
  assert.doesNotMatch(
    css,
    /\.undo-toast-close\s*{[\s\S]*position:\s*absolute;/
  )
})
