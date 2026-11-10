/**
 * Simple in-memory rate limiter.
 *
 * For production this should be backed by Redis (migration path:
 * @upstash/redis or ioredis). This in-process implementation is enough to
 * protect the sensitive routes of the MVP from abuse.
 *
 * Design (bug 1-4 redesign):
 *  - `rateLimit(key, opts)` is a generic sliding-window counter. It is also
 *    used directly by the login route for the *failed-attempt* bucket.
 *  - Only FAILED login attempts are punished: successful logins call
 *    `clearRateLimit(key)` so a user who remembers their password is never
 *    locked out (previously every attempt — success or fail — consumed
 *    quota and sandbox/NAT users got locked out immediately).
 *  - Buckets are periodically swept (every ~10 min) so the Map cannot grow
 *    without bound (memory leak fix). The sweep runs both lazily (piggy-
 *    backed on rateLimit calls) and on an unref'd timer.
 *
 * Key conventions:
 *  - per-IP route limit:   `${ip}:${route}`
 *  - per-user limit:       `${ip}:user:${userId}` (via customKey)
 *  - failed-login bucket:  `${ip}:${identifier}` (ip + account under attack)
 */

interface Bucket {
  timestamps: number[]
  /** Window used by the timestamps in this bucket (for sweeping). */
  windowMs: number
}

const buckets = new Map<string, Bucket>()

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // sweep every ~10 minutes

interface RateLimitOptions {
  /** Max number of requests allowed */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
  /**
   * When false, the call only INSPECTS the bucket (peek) without consuming
   * a token. Used by the login route's lockout pre-check so that blocked
   * accounts are rejected before any bcrypt work, while legitimate attempts
   * only spend a token when they actually fail.
   */
  consume?: boolean
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/** Delete every expired timestamp; drop buckets that became empty. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    const valid = bucket.timestamps.filter((t) => now - t < bucket.windowMs)
    if (valid.length === 0) {
      buckets.delete(key)
    } else {
      bucket.timestamps = valid
    }
  }
}

// Periodic cleanup. Stored on globalThis so Next.js dev-mode module
// reloading does not spawn a new timer on every hot reload. `unref()` keeps
// the timer from holding the process open.
const globalForRateLimit = globalThis as unknown as {
  __ejarebanRateLimitTimer?: ReturnType<typeof setInterval>
}
if (!globalForRateLimit.__ejarebanRateLimitTimer) {
  const timer = setInterval(() => sweep(Date.now()), CLEANUP_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
  globalForRateLimit.__ejarebanRateLimitTimer = timer
}

export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  const consume = opts.consume !== false

  // Lazy piggy-backed sweep (at most once per cleanup interval) so buckets
  // are reclaimed even if the timer was never scheduled.
  const globalForSweep = globalThis as unknown as {
    __ejarebanRateLimitLastSweep?: number
  }
  const lastSweep = globalForSweep.__ejarebanRateLimitLastSweep ?? 0
  if (now - lastSweep > CLEANUP_INTERVAL_MS) {
    globalForSweep.__ejarebanRateLimitLastSweep = now
    sweep(now)
  }

  const bucket = buckets.get(key)

  // Drop timestamps that fell out of the window
  const valid =
    bucket?.timestamps.filter((t) => now - t < opts.windowMs) ?? []

  if (valid.length >= opts.limit) {
    const oldest = valid[0]
    return {
      ok: false,
      remaining: 0,
      resetAt: oldest + opts.windowMs,
    }
  }

  if (consume) {
    valid.push(now)
    buckets.set(key, { timestamps: valid, windowMs: opts.windowMs })
  }
  return {
    ok: true,
    remaining: opts.limit - valid.length,
    resetAt: now + opts.windowMs,
  }
}

/**
 * Reset a bucket — used after a successful login so the failed-attempt
 * counter for `${ip}:${identifier}` starts from zero again.
 */
export function clearRateLimit(key: string): void {
  buckets.delete(key)
}

/** Extract the client IP from a request (honoring Caddy / X-Forwarded-For). */
export function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Default limits for sensitive routes */
export const RATE_LIMITS = {
  // Broad per-IP auth limit: generous on purpose so shared NAT / sandbox
  // IPs never lock out legitimate users. Brute-force protection is handled
  // by the per-account `authFail` bucket below.
  auth: { limit: 20, windowMs: 15 * 60 * 1000 },
  // Failed-login bucket (keyed by `${ip}:${identifier}`): 8 wrong passwords
  // per 15 minutes per account → then temporarily blocked.
  authFail: { limit: 8, windowMs: 15 * 60 * 1000 },
  // Registration: 5 accounts per hour per IP (own bucket — must NOT consume
  // login quota).
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Booking creation: 20 requests per 10 minutes per user
  createBooking: { limit: 20, windowMs: 10 * 60 * 1000 },
  // Review submission: 10 requests per 10 minutes per user
  createReview: { limit: 10, windowMs: 10 * 60 * 1000 },
  // Shahkar identity verification: 5 requests per hour
  verify: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Search/browse: 120 requests per minute (home fires 3 endpoints at once)
  search: { limit: 120, windowMs: 60 * 1000 },
  // Image upload: 60 uploads per minute
  upload: { limit: 60, windowMs: 60 * 1000 },
} as const

/** Check the rate limit and produce a 429 response when exceeded. */
export function checkRateLimit(
  req: Request,
  route: keyof typeof RATE_LIMITS | RateLimitOptions,
  customKey?: string,
): { ok: true } | { ok: false; response: Response } {
  const opts =
    typeof route === 'string' ? RATE_LIMITS[route] : route
  const ip = getClientIP(req)
  const key = customKey ? `${ip}:${customKey}` : `${ip}:${String(route)}`
  const result = rateLimit(key, opts)

  if (!result.ok) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.',
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(opts.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAt),
          },
        },
      ),
    }
  }
  return { ok: true }
}
