import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app wires the selection-state Area command box', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const keyboardSource = await readFile(
    new URL('./appKeyboardLogic.ts', import.meta.url),
    'utf8'
  )

  assert.match(keyboardSource, /'open-area-command-box'/)
  assert.match(keyboardSource, /state\.key === '\/'/)
  assert.match(appSource, /AreaCommandBox/)
  assert.match(appSource, /commandBoxState/)
  assert.match(appSource, /openAreaCommandBox/)
  assert.match(appSource, /commitAreaCommandBox/)
  assert.match(appSource, /onOpenCommandBox/)
})

test('command box commit never touches area text', async () => {
  const appSource = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )

  const commitBody = appSource.slice(
    appSource.indexOf('const commitAreaCommandBox'),
    appSource.indexOf('// Selection follow rule:')
  )

  assert.match(commitBody, /styles: \{/)
  assert.doesNotMatch(commitBody, /updateAreaText|removeCssSlashCommand/)
})

test('telemetry tracks command box open and abandon', async () => {
  const telemetrySource = await readFile(
    new URL('./telemetry.ts', import.meta.url),
    'utf8'
  )

  assert.match(telemetrySource, /'command_box_opened'/)
  assert.match(telemetrySource, /'command_box_abandoned'/)
})

test('area toolbar exposes the command box button', async () => {
  const areaSource = await readFile(
    new URL('./components/Area.tsx', import.meta.url),
    'utf8'
  )

  assert.match(areaSource, /onOpenCommandBox/)
  assert.match(areaSource, /aria-label="Open command box"/)
  assert.match(areaSource, /SlashCommandIcon/)
})

test('command box chrome uses semantic color tokens only', async () => {
  const css = await readFile(
    new URL('./components/areaCommandBox.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.area-command-box \{/)
  assert.match(css, /var\(--chrome-surface-rgb\)/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
})
