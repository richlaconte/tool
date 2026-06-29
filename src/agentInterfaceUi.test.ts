import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app exposes a reviewable agent suggestion flow', async () => {
  const source = await readFile(
    new URL('./App.tsx', import.meta.url),
    'utf8'
  )
  const css = await readFile(
    new URL('./App.css', import.meta.url),
    'utf8'
  )
  const commandSource = await readFile(
    new URL('./commandPaletteOptions.ts', import.meta.url),
    'utf8'
  )

  assert.match(commandSource, /id: 'agent-suggestions'/)
  assert.match(source, /suggestDecisionLog/)
  assert.match(source, /applyAgentPatch/)
  assert.match(source, /agentProposal/)
  assert.match(source, /Agent proposal/)
  assert.match(source, /Apply proposal/)
  assert.match(source, /Reject proposal/)
  assert.match(source, /Apply operation/)
  assert.match(source, /Reject operation/)
  assert.match(source, /applyAgentProposalOperation/)
  assert.match(source, /rejectAgentProposalOperation/)
  assert.match(source, /agentProposalError/)
  assert.match(source, /className="agent-proposal-error"/)
  assert.match(source, /role="alert"/)
  assert.match(source, /setAgentProposalError\(result\.errors\.join\(' '\)\)/)
  assert.match(css, /\.agent-proposal/)
  assert.match(css, /\.agent-proposal-operation-actions/)
  assert.match(css, /\.agent-proposal-error/)
})
