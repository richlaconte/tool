import { isTelemetryEvent } from '../../../src/telemetry'
import { createDatabase } from '../../../src/server/database'
import { createFixedWindowRateLimiter } from '../../../src/server/rateLimit'
import {
  isServerTelemetryDisabled,
  recordTelemetryEvent,
} from '../../../src/server/telemetryStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory only: the key never reaches storage, matching the "no request
// metadata stored — not even IP" telemetry principle.
const rateLimiter = createFixedWindowRateLimiter({
  limit: 120,
  windowMs: 60_000,
})

export const POST = async (request: Request) => {
  if (isServerTelemetryDisabled()) {
    return new Response(null, { status: 404 })
  }

  const clientKey =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local'

  if (!rateLimiter.check(clientKey).ok) {
    return new Response(null, { status: 429 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  const event =
    typeof payload === 'object' && payload !== null && 'event' in payload
      ? (payload as { event: unknown }).event
      : null

  if (!isTelemetryEvent(event)) {
    return new Response(null, { status: 400 })
  }

  recordTelemetryEvent(createDatabase(), event)

  return new Response(null, { status: 204 })
}
