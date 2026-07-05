import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../../src/server/auth'
import { createDatabase } from '../../../../src/server/database'
import { deletePage, getPageRecord } from '../../../../src/server/pageRepository'

type RouteContext = {
  params: Promise<{
    pageId: string
  }>
}

export const dynamic = 'force-dynamic'

export const DELETE = async (request: Request, { params }: RouteContext) => {
  return deleteOwnedPage(request, await params)
}

export const POST = async (request: Request, { params }: RouteContext) => {
  const url = new URL(request.url)
  if (url.searchParams.get('_method') !== 'delete') {
    return NextResponse.json({ error: 'unsupported-method' }, { status: 405 })
  }

  return deleteOwnedPage(request, await params)
}

const deleteOwnedPage = (
  request: Request,
  {
    pageId,
  }: {
    pageId: string
  }
) => {
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const page = getPageRecord(database, pageId)

  if (!page) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  if (!page.ownerUserId || page.ownerUserId !== user?.id) {
    return NextResponse.json({ error: 'owner-required' }, { status: 403 })
  }

  deletePage(database, pageId)

  if (request.method === 'POST') {
    return NextResponse.redirect(new URL('/shelf', request.url), 303)
  }

  return NextResponse.json({ deleted: true })
}
