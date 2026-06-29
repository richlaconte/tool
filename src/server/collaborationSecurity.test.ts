import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCollaborationSecurityState,
  getCollaborationSecurityConfigFromEnv,
  type CollaborationSecurityConfig,
} from './collaborationSecurity.ts'
import { redactSecurityLogEvent } from './securityLog.ts'

const config: CollaborationSecurityConfig = {
  maxConnectionsPerClient: 1,
  maxConnectionsPerPage: 2,
  maxPayloadBytes: 8,
  messageRateLimit: {
    limit: 2,
    windowMs: 1_000,
  },
}

test('collaboration security config reads environment limits', () => {
  assert.deepEqual(
    getCollaborationSecurityConfigFromEnv({
      TOOL_COLLABORATION_MAX_CONNECTIONS_PER_CLIENT: '3',
      TOOL_COLLABORATION_MAX_CONNECTIONS_PER_PAGE: '10',
      TOOL_COLLABORATION_MAX_PAYLOAD_BYTES: '2048',
      TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_MAX: '30',
      TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_WINDOW_MS: '5000',
    }),
    {
      maxConnectionsPerClient: 3,
      maxConnectionsPerPage: 10,
      maxPayloadBytes: 2048,
      messageRateLimit: {
        limit: 30,
        windowMs: 5000,
      },
    }
  )
})

test('collaboration security state limits active connections by client and page', () => {
  const security = createCollaborationSecurityState({
    config,
  })

  assert.equal(
    security.connect({
      clientId: 'client-a',
      pageId: 'page-1',
      socketId: 'socket-1',
    }).ok,
    true
  )
  assert.deepEqual(
    security.connect({
      clientId: 'client-a',
      pageId: 'page-1',
      socketId: 'socket-2',
    }),
    {
      ok: false,
      reason: 'client-connection-limit',
    }
  )
  assert.equal(
    security.connect({
      clientId: 'client-b',
      pageId: 'page-1',
      socketId: 'socket-3',
    }).ok,
    true
  )
  assert.deepEqual(
    security.connect({
      clientId: 'client-c',
      pageId: 'page-1',
      socketId: 'socket-4',
    }),
    {
      ok: false,
      reason: 'page-connection-limit',
    }
  )

  security.disconnect('socket-1')

  assert.equal(
    security.connect({
      clientId: 'client-a',
      pageId: 'page-1',
      socketId: 'socket-5',
    }).ok,
    true
  )
})

test('collaboration security state limits message rate and payload size', () => {
  let now = 1_000
  const security = createCollaborationSecurityState({
    config,
    now: () => now,
  })

  assert.equal(
    security.checkMessage({
      byteLength: 8,
      clientId: 'client-a',
      pageId: 'page-1',
    }).ok,
    true
  )
  assert.equal(
    security.checkMessage({
      byteLength: 8,
      clientId: 'client-a',
      pageId: 'page-1',
    }).ok,
    true
  )
  assert.deepEqual(
    security.checkMessage({
      byteLength: 8,
      clientId: 'client-a',
      pageId: 'page-1',
    }),
    {
      ok: false,
      reason: 'message-rate-limit',
      retryAfterSeconds: 1,
    }
  )

  now = 2_001

  assert.equal(
    security.checkMessage({
      byteLength: 8,
      clientId: 'client-a',
      pageId: 'page-1',
    }).ok,
    true
  )
  assert.deepEqual(
    security.checkMessage({
      byteLength: 9,
      clientId: 'client-a',
      pageId: 'page-1',
    }),
    {
      ok: false,
      reason: 'message-too-large',
    }
  )
})

test('security log events redact long client identifiers', () => {
  assert.deepEqual(
    redactSecurityLogEvent({
      type: 'collaboration-message-rate-limit',
      at: '2026-06-29T12:00:00.000Z',
      clientId: 'client-secret-token',
      pageId: 'page-1',
      reason: 'message-rate-limit',
    }),
    {
      type: 'collaboration-message-rate-limit',
      at: '2026-06-29T12:00:00.000Z',
      clientId: 'clie...oken',
      pageId: 'page-1',
      reason: 'message-rate-limit',
    }
  )
})
