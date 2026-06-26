import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createFixedWindowRateLimiter,
  getRateLimitConfigFromEnv,
} from './rateLimit.ts'

test('fixed-window rate limiter allows requests until the configured limit', () => {
  const limiter = createFixedWindowRateLimiter({
    limit: 2,
    now: () => 1_000,
    windowMs: 60_000,
  })

  assert.equal(limiter.check('client-a').ok, true)
  assert.equal(limiter.check('client-a').ok, true)

  const limited = limiter.check('client-a')

  assert.equal(limited.ok, false)
  assert.equal(limited.retryAfterSeconds, 60)
})

test('fixed-window rate limiter resets after the window elapses', () => {
  let now = 1_000
  const limiter = createFixedWindowRateLimiter({
    limit: 1,
    now: () => now,
    windowMs: 1_000,
  })

  assert.equal(limiter.check('client-a').ok, true)
  assert.equal(limiter.check('client-a').ok, false)

  now = 2_001

  assert.equal(limiter.check('client-a').ok, true)
})

test('rate limit config reads MCP environment defaults', () => {
  const config = getRateLimitConfigFromEnv({
    TOOL_MCP_RATE_LIMIT_MAX: '12',
    TOOL_MCP_RATE_LIMIT_WINDOW_MS: '30000',
  })

  assert.deepEqual(config, {
    limit: 12,
    windowMs: 30_000,
  })
})
