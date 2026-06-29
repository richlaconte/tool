import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('app exposes fixed canvas zoom controls', async () => {
  const source = await readProjectFile('src/App.tsx')
  const css = await readProjectFile('src/App.css')

  assert.match(source, /className="canvas-zoom-controls"/)
  assert.match(source, /aria-label="Zoom out"/)
  assert.match(source, /aria-label=\{`Reset zoom from/)
  assert.match(source, /aria-label="Zoom in"/)
  assert.match(source, /aria-label="Zoom to fit"/)
  assert.match(source, /formatCanvasZoom\(zoom\)/)
  assert.match(css, /\.canvas-zoom-controls\s*{[\s\S]*position:\s*fixed;/)
})

test('app renders a scaled canvas world inside the scroll container', async () => {
  const source = await readProjectFile('src/App.tsx')
  const css = await readProjectFile('src/App.css')

  assert.match(source, /className="canvas-scroll-size"/)
  assert.match(source, /className=\{`canvas-world/)
  assert.match(source, /--canvas-zoom/)
  assert.match(css, /\.canvas-scroll-size/)
  assert.match(css, /\.canvas-world\s*{[\s\S]*transform:\s*scale\(var\(--canvas-zoom\)\);/)
})

test('command palette exposes canvas zoom commands', async () => {
  const source = await readProjectFile('src/commandPaletteOptions.ts')

  assert.match(source, /id: 'zoom-in'/)
  assert.match(source, /id: 'zoom-out'/)
  assert.match(source, /id: 'reset-zoom'/)
  assert.match(source, /id: 'zoom-to-fit'/)
  assert.match(source, /id: 'zoom-to-selection'/)
})

test('zoomed canvas interactions use logical coordinate conversion', async () => {
  const source = await readProjectFile('src/App.tsx')
  const areaSource = await readProjectFile('src/components/Area.tsx')

  assert.match(source, /screenToCanvasPoint/)
  assert.match(source, /addEventListener\('wheel'/)
  assert.match(areaSource, /canvasZoom/)
  assert.match(areaSource, /\/ canvasZoom/)
})
