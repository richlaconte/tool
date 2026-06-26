import { NextResponse } from 'next/server'

import { createDatabase } from '../src/server/database'
import { createPageWithShareLinks } from '../src/server/pageRepository'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => {
  const database = createDatabase()
  const { page } = createPageWithShareLinks(database)
  const protocol = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? new URL(request.url).host

  return NextResponse.redirect(
    new URL(`/p/${page.id}`, `${protocol}://${host}`)
  )
}
