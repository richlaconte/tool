// Print the telemetry counter table: pnpm telemetry:report
import { createDatabase } from '../src/server/database.ts'
import { listTelemetryCounts } from '../src/server/telemetryStore.ts'

const rows = listTelemetryCounts(createDatabase())

if (rows.length === 0) {
  console.log('No telemetry events recorded.')
} else {
  console.table(rows)
}
