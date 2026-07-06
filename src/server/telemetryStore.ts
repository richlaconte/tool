import type { ToolDatabase } from './database.ts'

export type TelemetryCountRow = {
  event: string
  day: string
  count: number
}

export const isServerTelemetryDisabled = (
  env: Record<string, string | undefined> = process.env
) => env.TOOL_TELEMETRY_DISABLED === 'true'

export const getTelemetryDay = (now: Date = new Date()) =>
  now.toISOString().slice(0, 10)

// The stored shape is deliberately exactly (event, day, count): no request
// metadata, no identifiers, no content. See docs/telemetry.md.
export const recordTelemetryEvent = (
  database: ToolDatabase,
  event: string,
  now: Date = new Date()
) => {
  database
    .prepare(
      `insert into telemetry_counts (event, day, count)
       values (?, ?, 1)
       on conflict (event, day) do update set count = count + 1`
    )
    .run(event, getTelemetryDay(now))
}

export const listTelemetryCounts = (
  database: ToolDatabase
): TelemetryCountRow[] =>
  database
    .prepare(
      `select event, day, count from telemetry_counts
       order by day desc, event asc`
    )
    .all() as TelemetryCountRow[]
