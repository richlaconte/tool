import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('MCP route is explicit no-auth, rate-limited, and GLM-aware', async () => {
  const source = await readFile(
    new URL('../app/api/mcp/route.ts', import.meta.url),
    'utf8'
  )
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8')

  assert.match(source, /handleMcpJsonRpcRequest/)
  assert.match(source, /createFixedWindowRateLimiter/)
  assert.match(source, /TOOL_MCP_ENABLED/)
  assert.match(source, /getGlmProviderConfigFromEnv/)
  assert.match(source, /createGlmDecisionLogText/)
  assert.match(source, /recordMcpAgentAction/)
  assert.match(source, /listMcpAgentActions/)
  assert.match(source, /listAgentActions/)
  assert.match(source, /recordAgentAction/)
  assert.doesNotMatch(source, /Authorization/)
  assert.doesNotMatch(source, /Bearer/)
  assert.match(env, /TOOL_MCP_ENABLED/)
  assert.match(env, /TOOL_MCP_RATE_LIMIT_MAX/)
  assert.match(env, /GLM_API_KEY/)
  assert.match(env, /GLM_MODEL/)
})
