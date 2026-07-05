import assert from 'node:assert/strict'
import test from 'node:test'

import {
  completeGitHubOAuth,
  createAuthSession,
  createGitHubLoginRedirect,
  getAuthConfig,
  getUserFromCookie,
} from './auth.ts'
import { createInMemoryDatabase } from './database.ts'

const now = '2026-07-05T12:00:00.000Z'
const requestUrl = 'https://cascadery.test/api/auth/login'
const authEnv = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
}

test('auth config stays disabled unless GitHub OAuth env is complete', () => {
  assert.equal(getAuthConfig({}), null)
  assert.equal(getAuthConfig({ GITHUB_CLIENT_ID: 'client-id' }), null)
  assert.deepEqual(getAuthConfig(authEnv), {
    clientId: 'client-id',
    clientSecret: 'client-secret',
  })
})

test('GitHub login redirect stores state and requests only public profile', () => {
  const config = getAuthConfig(authEnv)
  assert.ok(config)

  const result = createGitHubLoginRedirect({
    config,
    createState: () => 'state-token',
    now,
    requestUrl,
  })

  assert.equal(result.kind, 'redirect')
  assert.equal(
    result.location,
    'https://github.com/login/oauth/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fcascadery.test%2Fapi%2Fauth%2Fcallback&state=state-token'
  )
  assert.match(result.setCookie, /tool\.authState=state-token/)
  assert.match(result.setCookie, /HttpOnly/)
  assert.doesNotMatch(result.location, /scope=/)
})

test('GitHub callback rejects state mismatch before exchanging the code', async () => {
  const config = getAuthConfig(authEnv)
  assert.ok(config)
  const database = createInMemoryDatabase()
  let exchangeAttempted = false

  const result = await completeGitHubOAuth({
    code: 'oauth-code',
    config,
    cookieHeader: 'tool.authState=expected-state',
    database,
    fetchJson: async () => {
      exchangeAttempted = true
      return {}
    },
    now,
    state: 'wrong-state',
  })

  assert.deepEqual(result, {
    kind: 'forbidden',
    reason: 'state-mismatch',
  })
  assert.equal(exchangeAttempted, false)
})

test('GitHub callback upserts the user and stores a hashed auth session', async () => {
  const config = getAuthConfig(authEnv)
  assert.ok(config)
  const database = createInMemoryDatabase()
  const calls: string[] = []

  const result = await completeGitHubOAuth({
    code: 'oauth-code',
    config,
    cookieHeader: 'tool.authState=state-token',
    createSessionToken: () => 'plain-session-token',
    database,
    fetchJson: async (url) => {
      calls.push(url)
      if (url === 'https://github.com/login/oauth/access_token') {
        return { access_token: 'github-access-token' }
      }

      return {
        avatar_url: 'https://avatars.test/octo.png',
        id: 123,
        login: 'octocat',
        name: 'The Octocat',
      }
    },
    now,
    state: 'state-token',
  })

  assert.equal(result.kind, 'ok')
  assert.equal(result.user.login, 'octocat')
  assert.match(result.setCookie, /tool\.authSession=/)
  assert.match(result.clearStateCookie, /tool\.authState=;/)
  assert.deepEqual(calls, [
    'https://github.com/login/oauth/access_token',
    'https://api.github.com/user',
  ])

  const rawSession = database
    .prepare('select token_hash as tokenHash from auth_sessions')
    .get() as { tokenHash: string }

  assert.notEqual(rawSession.tokenHash, 'plain-session-token')
  assert.match(rawSession.tokenHash, /^[a-f0-9]{64}$/)
  assert.equal(
    getUserFromCookie(database, result.setCookie, {
      now: Date.parse(now),
    })?.login,
    'octocat'
  )
})

test('auth sessions expire and logout invalidates them', () => {
  const database = createInMemoryDatabase()
  const session = createAuthSession(database, {
    createToken: () => 'session-token',
    now,
    user: {
      avatarUrl: null,
      displayName: 'Octo',
      githubId: '123',
      id: 'user_1',
      login: 'octo',
    },
  })

  assert.equal(
    getUserFromCookie(database, session.setCookie, {
      now: Date.parse(now) + 60_000,
    })?.id,
    'user_1'
  )
  assert.equal(
    getUserFromCookie(database, session.setCookie, {
      now: Date.parse(now) + 31 * 24 * 60 * 60 * 1000,
    }),
    null
  )
})
