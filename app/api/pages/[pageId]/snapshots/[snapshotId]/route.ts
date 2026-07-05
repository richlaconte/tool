import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../../../../src/server/auth'
import { createDatabase } from '../../../../../../src/server/database'
import { getPageSessionSecret } from '../../../../../../src/server/pageAccess'
import {
  deletePageSnapshotMutation,
  getPageSnapshotRequest,
  restorePageSnapshotCopyMutation,
} from '../../../../../../src/server/pageSnapshotApi'

type RouteContext = {
  params: Promise<{
    pageId: string
    snapshotId: string
  }>
}

export const dynamic = 'force-dynamic'

export const GET = async (request: Request, { params }: RouteContext) => {
  const { pageId, snapshotId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const result = getPageSnapshotRequest({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
    snapshotId,
  })

  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: result.reason },
      {
        status: result.kind === 'forbidden' ? 403 : 404,
      }
    )
  }

  return NextResponse.json({
    snapshot: result.snapshot,
  })
}

export const POST = async (request: Request, { params }: RouteContext) => {
  const { pageId, snapshotId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const payload = await readJsonObject(request)

  if (payload?.action !== 'restore-copy') {
    return NextResponse.json(
      { error: 'invalid-action' },
      {
        status: 400,
      }
    )
  }

  const result = restorePageSnapshotCopyMutation({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    requestUrl: request.url,
    secret: getPageSessionSecret(),
    snapshotId,
  })

  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: result.reason },
      {
        status:
          result.kind === 'forbidden'
            ? 403
            : result.kind === 'not-found'
              ? 404
              : 400,
      }
    )
  }

  return NextResponse.json({
    editUrl: result.editUrl,
    pageId: result.pageId,
  })
}

export const DELETE = async (
  request: Request,
  { params }: RouteContext
) => {
  const { pageId, snapshotId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const result = deletePageSnapshotMutation({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
    snapshotId,
  })

  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: result.reason },
      {
        status: result.kind === 'forbidden' ? 403 : 404,
      }
    )
  }

  return NextResponse.json({
    ok: true,
  })
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
