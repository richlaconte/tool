export type RateLimitConfig = {
  limit: number
  windowMs: number
}

export type RateLimitResult =
  | {
      ok: true
      limit: number
      remaining: number
      resetAt: number
    }
  | {
      ok: false
      limit: number
      remaining: 0
      resetAt: number
      retryAfterSeconds: number
    }

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimiterOptions = RateLimitConfig & {
  now?: () => number
}

const DEFAULT_MCP_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000,
}

export const getRateLimitConfigFromEnv = (
  env: Record<string, string | undefined> = process.env
): RateLimitConfig => ({
  limit: readPositiveInteger(
    env.TOOL_MCP_RATE_LIMIT_MAX,
    DEFAULT_MCP_RATE_LIMIT.limit
  ),
  windowMs: readPositiveInteger(
    env.TOOL_MCP_RATE_LIMIT_WINDOW_MS,
    DEFAULT_MCP_RATE_LIMIT.windowMs
  ),
})

export const createFixedWindowRateLimiter = ({
  limit,
  now = Date.now,
  windowMs,
}: RateLimiterOptions) => {
  const buckets = new Map<string, RateLimitBucket>()

  return {
    check(key: string): RateLimitResult {
      const currentTime = now()
      const currentBucket = buckets.get(key)
      const bucket =
        currentBucket && currentBucket.resetAt > currentTime
          ? currentBucket
          : {
              count: 0,
              resetAt: currentTime + windowMs,
            }

      if (bucket.count >= limit) {
        buckets.set(key, bucket)

        return {
          ok: false,
          limit,
          remaining: 0,
          resetAt: bucket.resetAt,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((bucket.resetAt - currentTime) / 1000)
          ),
        }
      }

      bucket.count += 1
      buckets.set(key, bucket)

      return {
        ok: true,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: bucket.resetAt,
      }
    },
  }
}

const readPositiveInteger = (
  value: string | undefined,
  fallback: number
) => {
  const parsedValue = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback
}
