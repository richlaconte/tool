import { createHmac, timingSafeEqual } from 'node:crypto'

import { parseCookie, stringifySetCookie } from 'cookie'
import type { ShareMode } from './pageRepository.ts'

export const PAGE_SESSION_COOKIE = 'tool.pageSession'

export type PageSession = {
  pageId: string
  accessMode: ShareMode
  clientId: string
  expiresAt: number
  shareLinkUpdatedAt: string
}

export const createPageSessionCookie = (
  session: PageSession,
  secret: string,
  now = Date.now()
) =>
  stringifySetCookie({
    name: PAGE_SESSION_COOKIE,
    value: signSession(session, secret),
    httpOnly: true,
    maxAge: Math.max(
      0,
      Math.floor((session.expiresAt - now) / 1000)
    ),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

export const getPageSessionFromCookie = (
  cookieHeader: string | undefined,
  secret: string,
  now = Date.now()
): PageSession | null => {
  if (!cookieHeader) return null

  const signedSession = parseCookie(cookieHeader)[PAGE_SESSION_COOKIE]
  if (!signedSession) return null

  const session = verifySession(signedSession, secret)
  if (!session || session.expiresAt <= now) return null

  return session
}

const signSession = (session: PageSession, secret: string) => {
  const payload = base64UrlEncode(JSON.stringify(session))
  const signature = createSignature(payload, secret)

  return `${payload}.${signature}`
}

const verifySession = (
  signedSession: string,
  secret: string
): PageSession | null => {
  const [payload, signature] = signedSession.split('.')
  if (!payload || !signature) return null

  const expectedSignature = createSignature(payload, secret)
  if (!safeEqual(signature, expectedSignature)) return null

  try {
    const session = JSON.parse(base64UrlDecode(payload))

    return isPageSession(session) ? session : null
  } catch {
    return null
  }
}

const createSignature = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

const base64UrlEncode = (value: string) =>
  Buffer.from(value).toString('base64url')

const base64UrlDecode = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8')

const isPageSession = (value: unknown): value is PageSession =>
  typeof value === 'object' &&
  value !== null &&
  'pageId' in value &&
  'accessMode' in value &&
  'clientId' in value &&
  'expiresAt' in value &&
  'shareLinkUpdatedAt' in value &&
  typeof value.pageId === 'string' &&
  (value.accessMode === 'edit' || value.accessMode === 'view') &&
  typeof value.clientId === 'string' &&
  typeof value.expiresAt === 'number' &&
  typeof value.shareLinkUpdatedAt === 'string'
