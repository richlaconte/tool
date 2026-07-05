import { NextResponse } from 'next/server'

import { destroyAuthSession } from '../../../../src/server/auth'
import { createDatabase } from '../../../../src/server/database'

export const dynamic = 'force-dynamic'

export const POST = (request: Request) => {
  const clearCookie = destroyAuthSession(
    createDatabase(),
    request.headers.get('cookie') ?? undefined
  )
  const response = NextResponse.redirect(new URL('/', request.url))
  response.headers.append('Set-Cookie', clearCookie)

  return response
}
