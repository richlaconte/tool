import { NextResponse } from 'next/server'

import { createDatabase } from '../../../../../src/server/database'
import { getPageSessionSecret } from '../../../../../src/server/pageAccess'
import { createShareLinkMutation } from '../../../../../src/server/shareLinkApi'

type RouteContext = {
  params: Promise<{
    pageId: string
  }>
}

export const dynamic = 'force-dynamic'

export const POST = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const payload = await readJsonObject(request)
  const protocol = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? new URL(request.url).host
  const result = createShareLinkMutation({
    accessMode: payload?.accessMode,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database: createDatabase(),
    pageId,
    requestUrl: `${protocol}://${host}${new URL(request.url).pathname}`,
    secret: getPageSessionSecret(),
  })

  if (result.kind === 'bad-request') {
    return NextResponse.json(
      { error: result.reason },
      {
        status: 400,
      }
    )
  }

  if (result.kind === 'forbidden') {
    return NextResponse.json(
      { error: result.reason },
      {
        status: 403,
      }
    )
  }

  const response = NextResponse.json({
    accessMode: result.accessMode,
    url: result.url,
  })

  if (result.setCookie) {
    response.headers.append('Set-Cookie', result.setCookie)
  }

  return response
}

const readJsonObject = async (request: Request) => {
  try {
    const payload = await request.json()

    return typeof payload === 'object' &&
      payload !== null &&
      !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
