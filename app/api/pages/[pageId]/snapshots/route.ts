import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../../../src/server/auth'
import { createDatabase } from '../../../../../src/server/database'
import { getPageSessionSecret } from '../../../../../src/server/pageAccess'
import {
  createPageSnapshotMutation,
  listPageSnapshotsRequest,
} from '../../../../../src/server/pageSnapshotApi'

type RouteContext = {
  params: Promise<{
    pageId: string
  }>
}

export const dynamic = 'force-dynamic'

export const GET = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const result = listPageSnapshotsRequest({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
  })

  if (result.kind === 'forbidden') {
    return NextResponse.json(
      { error: result.reason },
      {
        status: 403,
      }
    )
  }

  return NextResponse.json({
    snapshots: result.snapshots,
  })
}

export const POST = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const payload = await readJsonObject(request)
  const result = createPageSnapshotMutation({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    createdByDisplayName:
      user?.displayName ?? user?.login ?? readString(payload?.createdBy),
    database,
    name: readString(payload?.name),
    pageId,
    secret: getPageSessionSecret(),
  })

  if (result.kind === 'ok') {
    return NextResponse.json({
      snapshot: result.snapshot,
    })
  }

  return NextResponse.json(
    { error: result.reason },
    {
      status:
        result.kind === 'forbidden'
          ? 403
          : result.kind === 'limit-reached'
            ? 409
            : 400,
    }
  )
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

const readString = (value: unknown) =>
  typeof value === 'string' ? value : ''
