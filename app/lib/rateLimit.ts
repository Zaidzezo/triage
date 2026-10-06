export interface RateLimitPolicy {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

type RateLimitStore = Map<string, number[]>

const globalForRateLimit = globalThis as typeof globalThis & {
  __triageRateLimitStore?: RateLimitStore
}

const store: RateLimitStore =
  globalForRateLimit.__triageRateLimitStore ??
  new Map<string, number[]>()

globalForRateLimit.__triageRateLimitStore = store

export function checkRateLimit(
  key: string,
  policy: RateLimitPolicy
): RateLimitResult {
  if (policy.limit <= 0 || policy.windowMs <= 0) {
    throw new Error("Invalid rate limit policy")
  }

  const now = Date.now()
  const cutoff = now - policy.windowMs

  const timestamps = (store.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff
  )

  if (timestamps.length >= policy.limit) {
    const resetAt = timestamps[0] + policy.windowMs

    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((resetAt - now) / 1000)
      ),
    }
  }

  timestamps.push(now)
  store.set(key, timestamps)

  const resetAt = timestamps[0] + policy.windowMs

  return {
    allowed: true,
    limit: policy.limit,
    remaining: Math.max(
      0,
      policy.limit - timestamps.length
    ),
    resetAt,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt - now) / 1000)
    ),
  }
}

export function getRateLimitHeaders(
  result: RateLimitResult
): Headers {
  const headers = new Headers()

  headers.set(
    "RateLimit-Limit",
    String(result.limit)
  )

  headers.set(
    "RateLimit-Remaining",
    String(result.remaining)
  )

  headers.set(
    "RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000))
  )

  if (!result.allowed) {
    headers.set(
      "Retry-After",
      String(result.retryAfterSeconds)
    )
  }

  return headers
}