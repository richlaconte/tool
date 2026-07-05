import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../../../src/server/auth'
import { createDatabase } from '../../../../../src/server/database'
import {
  getPageAccessModeFromRequestCookies,
  getPageSessionSecret,
} from '../../../../../src/server/pageAccess'
import { claimPage } from '../../../../../src/server/pageRepository'

type RouteContext = {
  params: Promise<{
    pageId: string
  }>
}

export const dynamic = 'force-dynamic'

export const POST = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)

  if (!user) {
    return NextResponse.json({ error: 'sign-in-required' }, { status: 401 })
  }

  const accessMode = getPageAccessModeFromRequestCookies({
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
  })

  if (accessMode !== 'edit') {
    return NextResponse.json(
      { error: 'edit-session-required' },
      { status: 403 }
    )
  }

  if (!claimPage(database, pageId, user.id)) {
    return NextResponse.json({ error: 'already-owned' }, { status: 409 })
  }

  return NextResponse.json({ ownerUserId: user.id })
}
