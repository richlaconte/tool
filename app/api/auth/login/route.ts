import { NextResponse } from 'next/server'

import {
  createGitHubLoginRedirect,
  getAuthConfig,
} from '../../../../src/server/auth'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => {
  const config = getAuthConfig()
  if (!config) {
    return NextResponse.json({ error: 'auth-disabled' }, { status: 404 })
  }

  const result = createGitHubLoginRedirect({
    config,
    requestUrl: request.url,
  })
  const response = NextResponse.redirect(result.location)
  response.headers.append('Set-Cookie', result.setCookie)

  return response
}
