import { createDatabase } from '../../../src/server/database'
import {
  createFixedWindowRateLimiter,
  getRateLimitConfigFromEnv,
} from '../../../src/server/rateLimit'
import { resolveCodeSnippet } from '../../../src/server/codeSnippets'

export const dynamic = 'force-dynamic'

const rateLimiter = createFixedWindowRateLimiter(
  getRateLimitConfigFromEnv({
    TOOL_MCP_RATE_LIMIT_MAX:
      process.env.TOOL_CODE_SNIPPET_RATE_LIMIT_MAX ?? '60',
    TOOL_MCP_RATE_LIMIT_WINDOW_MS:
      process.env.TOOL_CODE_SNIPPET_RATE_LIMIT_WINDOW_MS ?? '60000',
  })
)

export const GET = async (request: Request) => {
  const rateLimit = rateLimiter.check(getClientRateLimitKey(request))

  if (!rateLimit.ok) {
    return Response.json(
      {
        error: 'rate-limited',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        headers: {
          'Retry-After': `${rateLimit.retryAfterSeconds}`,
        },
        status: 429,
      }
    )
  }

  const url = new URL(request.url).searchParams.get('url') ?? ''
  const result = await resolveCodeSnippet(createDatabase(), url)

  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
      },
      {
        status: result.error === 'invalid-code-reference' ? 400 : 502,
      }
    )
  }

  return Response.json(result.snippet)
}

const getClientRateLimitKey = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown-client'
