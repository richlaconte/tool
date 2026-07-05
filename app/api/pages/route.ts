import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../src/server/auth'
import { createDatabase } from '../../../src/server/database'
import { createPageWithShareLinks } from '../../../src/server/pageRepository'

export const dynamic = 'force-dynamic'

export const POST = (request: Request) => {
  const database = createDatabase()
  const user = getUserFromRequest(database, request)

  if (!user) {
    return NextResponse.json({ error: 'sign-in-required' }, { status: 401 })
  }

  const created = createPageWithShareLinks(database, {
    ownerUserId: user.id,
  })
  const protocol = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? new URL(request.url).host
  const destination = new URL(
    `/p/${created.page.id}`,
    `${protocol}://${host}`
  )
  destination.searchParams.set('share', 'edit')
  destination.searchParams.set('token', created.editToken)

  return NextResponse.redirect(destination, 303)
}
