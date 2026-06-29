import type { ToolDatabase } from './database.ts'
import {
  regenerateShareToken,
  type ShareMode,
} from './pageRepository.ts'
import {
  getPageAccessFromSession,
  PAGE_SESSION_MAX_AGE_MS,
} from './pageAccess.ts'
import {
  createPageSessionCookie,
  getPageSessionFromCookie,
} from './shareSessions.ts'

export type ShareLinkMutationResult =
  | {
      kind: 'ok'
      accessMode: ShareMode
      setCookie: string | null
      url: string
    }
  | {
      kind: 'bad-request'
      reason: 'invalid-access-mode'
    }
  | {
      kind: 'forbidden'
      reason: 'edit-session-required'
    }

export const createShareLinkMutation = ({
  accessMode,
  cookieHeader,
  createToken,
  database,
  now = new Date().toISOString(),
  pageId,
  requestUrl,
  secret,
}: {
  accessMode: unknown
  cookieHeader?: string
  createToken?: () => string
  database: ToolDatabase
  now?: string
  pageId: string
  requestUrl: string
  secret: string
}): ShareLinkMutationResult => {
  if (accessMode !== 'edit' && accessMode !== 'view') {
    return {
      kind: 'bad-request',
      reason: 'invalid-access-mode',
    }
  }

  const currentTime = Date.parse(now)
  const session = getPageSessionFromCookie(
    cookieHeader,
    secret,
    Number.isFinite(currentTime) ? currentTime : Date.now()
  )
  const currentAccess = getPageAccessFromSession(
    database,
    pageId,
    session
  )

  if (!currentAccess || currentAccess.accessMode !== 'edit' || !session) {
    return {
      kind: 'forbidden',
      reason: 'edit-session-required',
    }
  }

  const regenerated = regenerateShareToken(
    database,
    pageId,
    accessMode,
    {
      createToken,
      now,
    }
  )

  const shareUrl = new URL(`/p/${pageId}`, requestUrl)
  shareUrl.searchParams.set('share', accessMode)
  shareUrl.searchParams.set('token', regenerated.token)

  return {
    kind: 'ok',
    accessMode,
    setCookie:
      accessMode === 'edit'
        ? createPageSessionCookie(
            {
              accessMode: 'edit',
              clientId: session.clientId,
              expiresAt:
                (Number.isFinite(currentTime)
                  ? currentTime
                  : Date.now()) + PAGE_SESSION_MAX_AGE_MS,
              pageId,
              shareLinkUpdatedAt: regenerated.shareLinkUpdatedAt,
            },
            secret,
            Number.isFinite(currentTime) ? currentTime : Date.now()
          )
        : null,
    url: shareUrl.toString(),
  }
}
