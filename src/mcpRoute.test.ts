import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('MCP route requires bearer auth, preserves explicit loopback anonymous mode, and is GLM-aware', async () => {
  const source = await readFile(
    new URL('../app/api/mcp/route.ts', import.meta.url),
    'utf8'
  )
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8')
  const metadataSource = await readFile(
    new URL('../app/api/mcp/.well-known/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /handleMcpJsonRpcRequest/)
  assert.match(source, /createFixedWindowRateLimiter/)
  assert.match(source, /TOOL_MCP_ENABLED/)
  assert.match(source, /TOOL_MCP_ALLOW_ANONYMOUS/)
  assert.match(source, /Authorization/)
  assert.match(source, /Bearer/)
  assert.match(source, /WWW-Authenticate/)
  assert.match(source, /validateMcpToken/)
  assert.match(source, /mcp-auth-denied/)
  assert.match(source, /createScopedMcpRateLimiters/)
  assert.match(source, /getGlmProviderConfigFromEnv/)
  assert.match(source, /createGlmDecisionLogText/)
  assert.match(source, /recordMcpAgentAction/)
  assert.match(source, /listMcpAgentActions/)
  assert.match(source, /listAgentActions/)
  assert.match(source, /recordAgentAction/)
  // 2026-07-28 stateless core: routing headers resolve through pure gateway
  // logic, and the SQLite task store plus fail-closed token check are wired.
  assert.match(source, /readMcpRoutingHeaders/)
  assert.match(source, /resolveMcpRequest/)
  assert.match(source, /taskStore/)
  assert.match(source, /createMcpTask/)
  assert.match(source, /getMcpTask/)
  assert.match(source, /cancelMcpTask/)
  assert.match(source, /listMcpTasks/)
  assert.match(source, /isMcpTokenActive/)
  assert.match(metadataSource, /protected_resource/)
  assert.match(metadataSource, /bearer/)
  assert.match(env, /TOOL_MCP_ENABLED/)
  assert.match(env, /TOOL_MCP_ALLOW_ANONYMOUS/)
  assert.match(env, /TOOL_MCP_RATE_LIMIT_MAX/)
  assert.match(env, /TOOL_MCP_WRITE_RATE_LIMIT_MAX/)
  assert.match(env, /TOOL_MCP_SUGGEST_RATE_LIMIT_MAX/)
  assert.match(env, /GLM_API_KEY/)
  assert.match(env, /GLM_MODEL/)
})
