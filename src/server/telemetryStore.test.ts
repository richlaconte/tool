import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import {
  getTelemetryDay,
  isServerTelemetryDisabled,
  listTelemetryCounts,
  recordTelemetryEvent,
} from './telemetryStore.ts'

test('recording increments a day-bucketed counter', () => {
  const database = createInMemoryDatabase()
  const day = new Date('2026-07-05T10:00:00Z')

  recordTelemetryEvent(database, 'area_created', day)
  recordTelemetryEvent(database, 'area_created', day)
  recordTelemetryEvent(
    database,
    'area_created',
    new Date('2026-07-06T10:00:00Z')
  )
  recordTelemetryEvent(database, 'mcp_request:get_page', day)

  assert.deepEqual(listTelemetryCounts(database), [
    { event: 'area_created', day: '2026-07-06', count: 1 },
    { event: 'area_created', day: '2026-07-05', count: 2 },
    { event: 'mcp_request:get_page', day: '2026-07-05', count: 1 },
  ])
})

test('day bucketing uses the UTC date', () => {
  assert.equal(
    getTelemetryDay(new Date('2026-07-05T23:59:59Z')),
    '2026-07-05'
  )
  assert.equal(
    getTelemetryDay(new Date('2026-07-06T00:00:01Z')),
    '2026-07-06'
  )
})

test('the stored table contains only event, day, and count', () => {
  const database = createInMemoryDatabase()
  const columns = database
    .prepare('pragma table_info(telemetry_counts)')
    .all() as Array<{ name: string }>

  assert.deepEqual(
    columns.map((column) => column.name).sort(),
    ['count', 'day', 'event']
  )
})

test('the server kill switch reads TOOL_TELEMETRY_DISABLED', () => {
  assert.equal(
    isServerTelemetryDisabled({ TOOL_TELEMETRY_DISABLED: 'true' }),
    true
  )
  assert.equal(isServerTelemetryDisabled({}), false)
})
