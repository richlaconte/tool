import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { parseCookie, stringifySetCookie } from 'cookie'

import type { ToolDatabase } from './database.ts'

export const AUTH_SESSION_COOKIE = 'tool.authSession'
export const AUTH_STATE_COOKIE = 'tool.authState'

const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const AUTH_STATE_MAX_AGE_SECONDS = 10 * 60

export type AuthConfig = {
  clientId: string
  clientSecret: string
}

export type AuthUser = {
  id: string
  githubId: string
  login: string
  displayName: string | null
  avatarUrl: string | null
}

export type FetchJson = (
  url: string,
  init?: RequestInit
) => Promise<unknown>

export const getAuthConfig = (
  env: Record<string, string | undefined> = process.env
): AuthConfig | null => {
  const clientId = env.GITHUB_CLIENT_ID?.trim()
  const clientSecret = env.GITHUB_CLIENT_SECRET?.trim()

  return clientId && clientSecret
    ? {
        clientId,
        clientSecret,
      }
    : null
}

export const createGitHubLoginRedirect = ({
  config,
  createState = createSecretToken,
  now = new Date().toISOString(),
  requestUrl,
}: {
  config: AuthConfig
  createState?: () => string
  now?: string
  requestUrl: string
}) => {
  const state = createState()
  const redirectUri = new URL('/api/auth/callback', requestUrl).toString()
  const location = new URL('https://github.com/login/oauth/authorize')
  location.searchParams.set('client_id', config.clientId)
  location.searchParams.set('redirect_uri', redirectUri)
  location.searchParams.set('state', state)

  return {
    kind: 'redirect' as const,
    location: location.toString(),
    setCookie: stringifySetCookie({
      name: AUTH_STATE_COOKIE,
      value: state,
      httpOnly: true,
      maxAge: AUTH_STATE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }),
    stateCreatedAt: now,
  }
}

export const completeGitHubOAuth = async ({
  code,
  config,
  cookieHeader,
  createSessionToken,
  database,
  fetchJson = defaultFetchJson,
  now = new Date().toISOString(),
  requestUrl = 'https://cascadery.test/api/auth/callback',
  state,
}: {
  code: string
  config: AuthConfig
  cookieHeader?: string
  createSessionToken?: () => string
  database: ToolDatabase
  fetchJson?: FetchJson
  now?: string
  requestUrl?: string
  state: string
}) => {
  const expectedState = parseCookie(cookieHeader ?? '')[AUTH_STATE_COOKIE]

  if (!state || !expectedState || state !== expectedState) {
    return {
      kind: 'forbidden' as const,
      reason: 'state-mismatch' as const,
    }
  }

  const tokenPayload = await fetchJson(
    'https://github.com/login/oauth/access_token',
    {
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: new URL('/api/auth/callback', requestUrl).toString(),
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  )
  const accessToken = readStringProperty(tokenPayload, 'access_token')
  if (!accessToken) {
    return {
      kind: 'forbidden' as const,
      reason: 'exchange-failed' as const,
    }
  }

  const profile = await fetchJson('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const user = upsertGitHubUser(database, profile, now)
  const session = createAuthSession(database, {
    createToken: createSessionToken,
    now,
    user,
  })

  return {
    kind: 'ok' as const,
    clearStateCookie: clearCookie(AUTH_STATE_COOKIE),
    setCookie: session.setCookie,
    user,
  }
}

export const createAuthSession = (
  database: ToolDatabase,
  {
    createToken = createSecretToken,
    now = new Date().toISOString(),
    user,
  }: {
    createToken?: () => string
    now?: string
    user: AuthUser
  }
) => {
  upsertUser(database, user, now)

  const token = createToken()
  const expiresAt = new Date(
    Date.parse(now) + AUTH_SESSION_MAX_AGE_MS
  ).toISOString()
  database
    .prepare(
      `insert into auth_sessions
        (id, user_id, token_hash, created_at, expires_at)
       values (?, ?, ?, ?, ?)`
    )
    .run(createId('auth_session'), user.id, hashToken(token), now, expiresAt)

  return {
    setCookie: stringifySetCookie({
      name: AUTH_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      maxAge: AUTH_SESSION_MAX_AGE_MS / 1000,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }),
    token,
  }
}

export const getUserFromRequest = (
  database: ToolDatabase,
  request: Request,
  { now = Date.now() }: { now?: number } = {}
) =>
  getUserFromCookie(database, request.headers.get('cookie') ?? undefined, {
    now,
  })

export const getUserFromCookie = (
  database: ToolDatabase,
  cookieHeader: string | undefined,
  { now = Date.now() }: { now?: number } = {}
): AuthUser | null => {
  const token = parseCookie(cookieHeader ?? '')[AUTH_SESSION_COOKIE]
  if (!token) return null

  const row = database
    .prepare(
      `select users.id,
              users.github_id as githubId,
              users.login,
              users.display_name as displayName,
              users.avatar_url as avatarUrl,
              auth_sessions.expires_at as expiresAt
       from auth_sessions
       join users on users.id = auth_sessions.user_id
       where auth_sessions.token_hash = ?
       limit 1`
    )
    .get(hashToken(token)) as (AuthUser & { expiresAt: string }) | undefined

  if (!row || Date.parse(row.expiresAt) <= now) return null

  return {
    avatarUrl: row.avatarUrl,
    displayName: row.displayName,
    githubId: row.githubId,
    id: row.id,
    login: row.login,
  }
}

export const destroyAuthSession = (
  database: ToolDatabase,
  cookieHeader: string | undefined
) => {
  const token = parseCookie(cookieHeader ?? '')[AUTH_SESSION_COOKIE]

  if (token) {
    database
      .prepare('delete from auth_sessions where token_hash = ?')
      .run(hashToken(token))
  }

  return clearCookie(AUTH_SESSION_COOKIE)
}

const upsertGitHubUser = (
  database: ToolDatabase,
  profile: unknown,
  now: string
): AuthUser => {
  const githubId = readNumberOrStringProperty(profile, 'id')
  const login = readStringProperty(profile, 'login')

  if (!githubId || !login) {
    throw new Error('GitHub user profile is missing required fields.')
  }

  const user: AuthUser = {
    avatarUrl: readStringProperty(profile, 'avatar_url'),
    displayName: readStringProperty(profile, 'name'),
    githubId,
    id: createId('user'),
    login,
  }

  const existing = database
    .prepare(
      `select id,
              github_id as githubId,
              login,
              display_name as displayName,
              avatar_url as avatarUrl
       from users
       where github_id = ?
       limit 1`
    )
    .get(githubId) as AuthUser | undefined

  const persisted = existing ? { ...user, id: existing.id } : user
  upsertUser(database, persisted, now)

  return persisted
}

const upsertUser = (
  database: ToolDatabase,
  user: AuthUser,
  now: string
) => {
  database
    .prepare(
      `insert into users
        (id, github_id, login, display_name, avatar_url, created_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(github_id) do update set
         login = excluded.login,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url`
    )
    .run(
      user.id,
      user.githubId,
      user.login,
      user.displayName,
      user.avatarUrl,
      now
    )
}

const defaultFetchJson: FetchJson = async (url, init) => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`)

  return response.json()
}

const readStringProperty = (value: unknown, key: string) =>
  typeof value === 'object' &&
  value !== null &&
  key in value &&
  typeof value[key as keyof typeof value] === 'string'
    ? (value[key as keyof typeof value] as string)
    : null

const readNumberOrStringProperty = (value: unknown, key: string) => {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return null
  }

  const property = value[key as keyof typeof value]

  return typeof property === 'number' || typeof property === 'string'
    ? String(property)
    : null
}

const clearCookie = (name: string) =>
  stringifySetCookie({
    name,
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const createSecretToken = () => randomBytes(32).toString('base64url')

const createId = (prefix: string) => `${prefix}_${randomUUID()}`
