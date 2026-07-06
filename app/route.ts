import { NextResponse } from 'next/server'

import { getAuthConfig, getUserFromRequest } from '../src/server/auth'
import { createDatabase } from '../src/server/database'
import { createPageWithShareLinks } from '../src/server/pageRepository'
import {
  isServerTelemetryDisabled,
  recordTelemetryEvent,
} from '../src/server/telemetryStore'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => {
  const database = createDatabase()
  const user = getAuthConfig() ? getUserFromRequest(database, request) : null

  if (user) {
    return NextResponse.redirect(new URL('/shelf', request.url))
  }

  const created = createPageWithShareLinks(database)

  if (!isServerTelemetryDisabled()) {
    recordTelemetryEvent(database, 'page_created')
  }

  const protocol = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? new URL(request.url).host
  const destination = new URL(
    `/p/${created.page.id}`,
    `${protocol}://${host}`
  )

  destination.searchParams.set('share', 'edit')
  destination.searchParams.set('token', created.editToken)

  return NextResponse.redirect(destination)
}
