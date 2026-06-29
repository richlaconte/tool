import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ToolDatabase } from './database.ts'
import {
  getActiveShareLinkUpdatedAt,
  validateShareToken,
  type ShareMode,
} from './pageRepository.ts'
import {
  createPageSessionCookie,
  getPageSessionFromCookie,
  type PageSession,
} from './shareSessions.ts'

export const PAGE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const DEVELOPMENT_PAGE_SESSION_SECRET =
  'development-only-page-session-secret-change-me'

export type PageAccessContext = {
  accessMode: ShareMode
  clientId: string
  pageId: string
  readOnly: boolean
}

export type PageHttpAccessResult =
  | {
      kind: 'allow'
      access: PageAccessContext
    }
  | {
      kind: 'redirect'
      location: string
      setCookie: string
    }
  | {
      kind: 'forbidden'
      reason:
        | 'invalid-share-token'
        | 'invalid-page-session'
        | 'missing-page-session'
    }

export type ResolvePageHttpAccessOptions = {
  cookieHeader?: string
  createClientId?: () => string
  database: ToolDatabase
  now?: number
  pageId: string
  requestUrl: string
  secret: string
}

export const resolvePageHttpAccess = ({
  cookieHeader,
  createClientId = () => `client_${randomUUID()}`,
  database,
  now = Date.now(),
  pageId,
  requestUrl,
  secret,
}: ResolvePageHttpAccessOptions): PageHttpAccessResult => {
  const url = new URL(requestUrl)
  const requestedMode = url.searchParams.get('share')
  const token = url.searchParams.get('token')

  if (requestedMode || token) {
    if (
      (requestedMode !== 'edit' && requestedMode !== 'view') ||
      !token
    ) {
      return {
        kind: 'forbidden',
        reason: 'invalid-share-token',
      }
    }

    const access = validateShareToken(
      database,
      pageId,
      requestedMode,
      token
    )

    if (!access) {
      return {
        kind: 'forbidden',
        reason: 'invalid-share-token',
      }
    }

    url.searchParams.delete('share')
    url.searchParams.delete('token')

    return {
      kind: 'redirect',
      location: url.toString(),
      setCookie: createPageSessionCookie(
        {
          accessMode: access.accessMode,
          clientId: createClientId(),
          expiresAt: now + PAGE_SESSION_MAX_AGE_MS,
          pageId,
          shareLinkUpdatedAt: access.shareLinkUpdatedAt,
        },
        secret,
        now
      ),
    }
  }

  const session = getPageSessionFromCookie(cookieHeader, secret, now)
  const access = getPageAccessFromSession(database, pageId, session)

  if (access) {
    return {
      kind: 'allow',
      access,
    }
  }

  return {
    kind: 'forbidden',
    reason: session
      ? 'invalid-page-session'
      : 'missing-page-session',
  }
}

export const getPageAccessFromSession = (
  database: ToolDatabase,
  pageId: string,
  session: PageSession | null
): PageAccessContext | null => {
  if (!session || session.pageId !== pageId) return null

  const activeShareLinkUpdatedAt = getActiveShareLinkUpdatedAt(
    database,
    pageId,
    session.accessMode
  )

  if (
    !activeShareLinkUpdatedAt ||
    activeShareLinkUpdatedAt !== session.shareLinkUpdatedAt
  ) {
    return null
  }

  return {
    accessMode: session.accessMode,
    clientId: session.clientId,
    pageId,
    readOnly: session.accessMode === 'view',
  }
}

export const getPageAccessModeFromRequestCookies = ({
  cookieHeader,
  database,
  now = Date.now(),
  pageId,
  secret,
}: {
  cookieHeader: string | undefined
  database: ToolDatabase
  now?: number
  pageId: string
  secret: string
}): ShareMode | null =>
  getPageAccessFromSession(
    database,
    pageId,
    getPageSessionFromCookie(cookieHeader, secret, now)
  )?.accessMode ?? null

export const handlePageAccessRequest = ({
  database,
  request,
  response,
  secret,
}: {
  database: ToolDatabase
  request: IncomingMessage
  response: ServerResponse
  secret: string
}) => {
  if (request.method !== 'GET') return false

  const requestUrl = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? 'localhost'}`
  )
  const pageId = getPageIdFromPagePathname(requestUrl.pathname)

  if (!pageId) return false

  const result = resolvePageHttpAccess({
    cookieHeader: request.headers.cookie,
    database,
    pageId,
    requestUrl: requestUrl.toString(),
    secret,
  })

  response.setHeader('Referrer-Policy', 'no-referrer')

  if (result.kind === 'allow') return false

  if (result.kind === 'redirect') {
    response.statusCode = 302
    response.setHeader('Location', result.location)
    response.setHeader('Set-Cookie', result.setCookie)
    response.end()
    return true
  }

  response.statusCode = 403
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end('This Cascadery page link is invalid or expired.')
  return true
}

export const getPageIdFromPagePathname = (pathname: string) => {
  const match = pathname.match(/^\/p\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export const getPageSessionSecret = () => {
  const secret =
    process.env.TOOL_PAGE_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET

  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TOOL_PAGE_SESSION_SECRET is required in production.'
    )
  }

  return DEVELOPMENT_PAGE_SESSION_SECRET
}
