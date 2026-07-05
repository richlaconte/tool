import { NextResponse } from 'next/server'

import {
  completeGitHubOAuth,
  getAuthConfig,
} from '../../../../src/server/auth'
import { createDatabase } from '../../../../src/server/database'

export const dynamic = 'force-dynamic'

export const GET = async (request: Request) => {
  const config = getAuthConfig()
  if (!config) {
    return NextResponse.json({ error: 'auth-disabled' }, { status: 404 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.json(
      { error: 'invalid-callback' },
      { status: 400 }
    )
  }

  const result = await completeGitHubOAuth({
    code,
    config,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database: createDatabase(),
    requestUrl: request.url,
    state,
  })

  if (result.kind !== 'ok') {
    return NextResponse.json({ error: result.reason }, { status: 403 })
  }

  const response = NextResponse.redirect(new URL('/shelf', request.url))
  response.headers.append('Set-Cookie', result.setCookie)
  response.headers.append('Set-Cookie', result.clearStateCookie)

  return response
}
