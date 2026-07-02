import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('area comments are exposed through toolbar, badge, panel, and command palette', async () => {
  const [appSource, areaSource, commandSource, appCss, areaCss] =
    await Promise.all([
      readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
      readFile(new URL('./components/Area.tsx', import.meta.url), 'utf8'),
      readFile(
        new URL('./commandPaletteOptions.ts', import.meta.url),
        'utf8'
      ),
      readFile(new URL('./App.css', import.meta.url), 'utf8'),
      readFile(new URL('./components/area.css', import.meta.url), 'utf8'),
    ])

  assert.match(commandSource, /id: 'comment-selected-area'/)
  assert.match(appSource, /className="area-comment-panel"/)
  assert.match(appSource, /getAreaThread\(comments, commentPanelArea\.id\)/)
  assert.match(appSource, /getUnresolvedCount\(comments, area\.id\)/)
  assert.match(areaSource, /className="area-comment-badge"/)
  assert.match(areaSource, /aria-label="Open Area comments"/)
  assert.match(appCss, /\.area-comment-panel\s*{/)
  assert.match(areaCss, /\.area-comment-badge\s*{/)
})
