import { NextResponse } from 'next/server'

import { getUserFromRequest } from '../../../../../src/server/auth'
import { createDatabase } from '../../../../../src/server/database'
import { getPageSessionSecret } from '../../../../../src/server/pageAccess'
import {
  createMcpTokenConnection,
  listMcpTokenConnections,
  revokeMcpTokenConnection,
} from '../../../../../src/server/mcpTokenApi'
import { listMcpAgentActions } from '../../../../../src/server/mcpAgentActions'

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
  const result = listMcpTokenConnections({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
  })

  if (result.kind === 'forbidden') {
    return NextResponse.json({ error: result.reason }, { status: 403 })
  }

  return NextResponse.json({
    tokens: result.tokens,
    actions: listMcpAgentActions(database, pageId).slice(0, 20),
  })
}

export const POST = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const payload = await readJsonObject(request)
  const result = createMcpTokenConnection({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    expiresAt:
      typeof payload?.expiresAt === 'string' ? payload.expiresAt : undefined,
    label: typeof payload?.label === 'string' ? payload.label : undefined,
    pageId,
    scopes: payload?.scopes,
    secret: getPageSessionSecret(),
  })

  return jsonMutationResult(result)
}

export const DELETE = async (request: Request, { params }: RouteContext) => {
  const { pageId } = await params
  const database = createDatabase()
  const user = getUserFromRequest(database, request)
  const payload = await readJsonObject(request)
  const result = revokeMcpTokenConnection({
    authenticatedUserId: user?.id ?? null,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    database,
    pageId,
    secret: getPageSessionSecret(),
    tokenId: payload?.tokenId,
  })

  return jsonMutationResult(result)
}

const jsonMutationResult = (result: ReturnType<
  typeof createMcpTokenConnection
>) => {
  if (result.kind === 'forbidden') {
    return NextResponse.json({ error: result.reason }, { status: 403 })
  }

  if (result.kind === 'bad-request') {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  return NextResponse.json({
    token: result.token,
    tokens: result.tokens,
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
