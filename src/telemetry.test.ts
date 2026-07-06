import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  TELEMETRY_EVENTS,
  createTelemetryClient,
  isBrowserTelemetryDisabled,
  isTelemetryEvent,
} from './telemetry.ts'

test('trackEvent sends the event payload to the endpoint', () => {
  const sent: Array<{ url: string; payload: string }> = []
  const client = createTelemetryClient({
    isDisabled: () => false,
    sendBeacon: (url, payload) => sent.push({ url, payload }),
  })

  assert.equal(client.trackEvent('area_created'), true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, '/api/telemetry')
  assert.deepEqual(JSON.parse(sent[0].payload), {
    event: 'area_created',
  })
})

test('trackEvent no-ops silently when disabled', () => {
  let sends = 0
  const client = createTelemetryClient({
    isDisabled: () => true,
    sendBeacon: () => {
      sends += 1
    },
  })

  assert.equal(client.trackEvent('page_created'), false)
  assert.equal(sends, 0)
})

test('trackEvent swallows sendBeacon failures', () => {
  const client = createTelemetryClient({
    isDisabled: () => false,
    sendBeacon: () => {
      throw new Error('beacon rejected')
    },
  })

  assert.equal(client.trackEvent('page_created'), false)
})

test('browser disable honors the meta flag and the stored opt-out', () => {
  assert.equal(
    isBrowserTelemetryDisabled({
      getMetaContent: () => 'disabled',
      getStoredOptOut: () => null,
    }),
    true
  )
  assert.equal(
    isBrowserTelemetryDisabled({
      getMetaContent: () => null,
      getStoredOptOut: () => 'true',
    }),
    true
  )
  assert.equal(
    isBrowserTelemetryDisabled({
      getMetaContent: () => null,
      getStoredOptOut: () => null,
    }),
    false
  )
})

test('isTelemetryEvent accepts only the closed union', () => {
  assert.equal(isTelemetryEvent('area_created'), true)
  assert.equal(isTelemetryEvent('mcp_request:get_page'), false)
  assert.equal(isTelemetryEvent('anything_else'), false)
  assert.equal(isTelemetryEvent(42), false)
})

test('the published event list matches the TelemetryEvent union', () => {
  const doc = readFileSync(
    new URL('../docs/telemetry.md', import.meta.url),
    'utf8'
  )
  const documented = [...doc.matchAll(/^- `([a-z_]+)`$/gm)].map(
    (match) => match[1]
  )

  assert.deepEqual(documented, [...TELEMETRY_EVENTS])
})
