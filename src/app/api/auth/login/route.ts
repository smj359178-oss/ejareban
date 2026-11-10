import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, setSessionCookie } from '@/lib/auth'
import { checkRateLimit, rateLimit, clearRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({
  identifier: z.string().min(3).max(80),
  password: z.string().min(1).max(200),
})

/**
 * POST /api/auth/login
 *
 * Body: { identifier, password }
 *
 * `identifier` can be either the user's email or their username. We try both
 * in `authenticate()` and return a 401 if neither matches.
 *
 * Rate-limit design (bugs 1+2 — "one wrong password = hacker" fix):
 *  1. Broad per-IP `auth` bucket (20 / 15 min) — generous on purpose so
 *     shared NAT / sandbox IPs never lock out legitimate users.
 *  2. Per-account `authFail` bucket keyed `${ip}:${identifier}` — only
 *     FAILED attempts consume a token (8 / 15 min). When exhausted we answer
 *     429 with the Persian lockout message. Successful logins call
 *     `clearRateLimit` on this bucket so the counter resets — a user who
 *     logs in successfully is never throttled away.
 *
 * On success, sets the `ejareban-user` HttpOnly cookie (HMAC-signed token)
 * and returns the public user shape so the client can update its UI.
 */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  // 1) Broad per-IP flood protection (not a lockout for normal users).
  const rl = checkRateLimit(req, 'auth')
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const identifierLower = parsed.data.identifier.trim().toLowerCase()
  const failKey = `${getClientIP(req)}:${identifierLower}`

  // 2) Lockout check BEFORE any bcrypt work: once 8 consecutive failures
  //    have been recorded for this (ip, account), block every attempt —
  //    including correct passwords — until the 15-minute window slides.
  //    This makes online brute-force infeasible while keeping the threshold
  //    generous enough that real users are never caught by it (bug 1).
  const failCheck = rateLimit(failKey, {
    ...RATE_LIMITS.authFail,
    consume: false,
  })
  if (!failCheck.ok) {
    const retryAfter = Math.ceil((failCheck.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      {
        error:
          'به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً برای این حساب مسدود شده است. ۱۵ دقیقه دیگر دوباره تلاش کنید.',
        retryAfter,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    )
  }

  const user = await authenticate(parsed.data.identifier, parsed.data.password)
  if (!user) {
    // A FAILED attempt: consume one token from the per-(ip, account) bucket.
    rateLimit(failKey, RATE_LIMITS.authFail)
    // Same error message for "user not found" and "wrong password" so an
    // attacker cannot enumerate accounts via the API.
    return NextResponse.json(
      { error: 'نام کاربری یا رمز عبور اشتباه است.' },
      { status: 401 },
    )
  }

  // 3) Success → reset the failed-attempt counter for this (ip, account).
  clearRateLimit(failKey)

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
      isIdentityVerified: user.isIdentityVerified,
      trustScore: user.trustScore,
    },
  })
  res.headers.set('Set-Cookie', setSessionCookie(user.id))
  return res
}
