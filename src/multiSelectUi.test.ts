import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app wires blank-canvas marquee selection before area creation', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /marqueeDragRef/)
  assert.match(source, /isMarqueeDrag/)
  assert.match(source, /getMarqueeRect/)
  assert.match(source, /getMarqueeSelection\(selectionRect, areas\)/)
  assert.match(source, /className="marquee-selection-box"/)
})

test('app applies style dialog and css slash commands to the active selection', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /const getAreaActionTargetIds/)
  assert.match(source, /selectedAreaIds\.includes\(areaId\)/)
  assert.match(source, /targetAreaIds\.has\(area\.id\)/)
  assert.match(source, /removeCssSlashCommand\(area\.text, command\)/)
})

test('app restores multi-area deletion snapshots together', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /type DeletedAreasSnapshot/)
  assert.match(source, /deleteAreas\(areas, targetAreaIds\)/)
  assert.match(source, /restoreDeletedAreas\(prev, deletedAreaSnapshot\)/)
  assert.match(source, /result\.deletedAreas\.flatMap/)
})

test('keyboard delete routes through the selected-area bulk delete path', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /deleteSelectedAreasRef/)
  assert.match(source, /e\.key === 'Delete' \|\| e\.key === 'Backspace'/)
  assert.match(source, /deleteAreaById\(firstSelectedAreaId\)/)
})
