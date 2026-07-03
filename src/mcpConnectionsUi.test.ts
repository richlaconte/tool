import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('agent connections UI is reachable from command palette and share dialog', async () => {
  const appSource = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(commandSource, /id: 'agent-connections'/)
  assert.match(commandSource, /title: 'Agent connections'/)
  assert.match(appSource, /openDialogId === 'agent-connections'/)
  assert.match(appSource, /\/api\/pages\/\$\{page\.id\}\/mcp-tokens/)
  assert.match(appSource, /Create agent token/)
  assert.match(appSource, /Revoke/)
  assert.match(appSource, /Setup snippet/)
  assert.match(appSource, /setOpenDialogId\('agent-connections'\)/)
})
