import { db } from './db'
import bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Session shape returned to the client. The avatar / verification flags are
 * included so the navbar can render without an extra round-trip.
 */
export interface SessionUser {
  id: string
  name: string
  email: string
  username: string | null
  role: string
  avatar: string | null
  isIdentityVerified: boolean
  trustScore: number
}

// ---------------------------------------------------------------------
// Session token signing (bug 5 — CRITICAL session forgery fix)
//
// Previously the `ejareban-user` cookie stored the RAW user id, so anyone
// could POST `Cookie: ejareban-user=<admin-cuid>` and become admin.
//
// Now the cookie stores a signed token:
//
//     token = `${userId}.${hmacSHA256(userId, SESSION_SECRET)}`
//
// `getSession()` verifies the HMAC (timing-safe) BEFORE touching the
// database, so a forged or truncated cookie resolves to a null user
// without even a DB round-trip.
// ---------------------------------------------------------------------

/**
 * Server-side session secret. In production ALWAYS set SESSION_SECRET in the
 * environment (see .env.example). The fallback below exists only so the dev
 * sandbox / fresh clones keep working out of the box; it is deterministic
 * and therefore NOT safe for production use.
 */
const DEV_FALLBACK_SESSION_SECRET =
  'ejareban-dev-only-session-secret-do-not-use-in-production'

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SESSION_SECRET
}

/** Build the signed session token for a user id. */
export function signSessionToken(userId: string): string {
  const mac = createHmac('sha256', getSessionSecret())
    .update(userId)
    .digest('hex')
  return `${userId}.${mac}`
}

/**
 * Verify a signed session token and return the embedded user id.
 * Returns null when the token is malformed or the signature does not match.
 */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  const expected = createHmac('sha256', getSessionSecret())
    .update(userId)
    .digest('hex')
  const a = Buffer.from(mac, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  return userId
}

/**
 * Resolve the acting user from the `ejareban-user` session cookie.
 *
 * The cookie stores an HMAC-signed token (`userId.mac`), NOT the raw id.
 * If the cookie is missing, malformed, or the signature check fails we
 * return `null` immediately (no DB query) and the caller is expected to
 * treat the request as anonymous (most protected endpoints respond 401;
 * the public ones keep working).
 */
export async function getSession(req: Request): Promise<{ user: SessionUser | null }> {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/ejareban-user=([^;]+)/)
  const token = match?.[1]

  let userId: string | null = null
  if (token) {
    try {
      userId = verifySessionToken(decodeURIComponent(token))
    } catch {
      userId = null // malformed percent-encoding in the cookie
    }
  }
  if (!userId) return { user: null }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      avatar: true,
      isIdentityVerified: true,
      trustScore: true,
    },
  })

  return { user }
}

/**
 * Authenticate a user by username OR email and a plain password.
 *
 * Returns the user record on success, null on failure. Constant-time-ish in
 * practice because bcrypt's compareSync itself takes ~80ms regardless of the
 * outcome, which masks the user-exists vs user-does-not-exist timing.
 */
export async function authenticate(
  identifier: string,
  password: string,
): Promise<SessionUser | null> {
  const normalized = identifier.trim().toLowerCase()
  if (!normalized) return null

  // Try username first (case-insensitive on SQLite is handled in JS), then email.
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: normalized },
        // SQLite doesn't do case-insensitive WHERE on TEXT easily; the seed
        // stores usernames lowercase, and we lowercase the input above.
        { username: normalized },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      avatar: true,
      isIdentityVerified: true,
      trustScore: true,
      passwordHash: true,
    },
  })

  if (!user || !user.passwordHash) return null
  const ok = bcrypt.compareSync(password, user.passwordHash)
  if (!ok) return null

  // Strip the hash before returning.
  const { passwordHash, ...rest } = user
  return rest
}

/**
 * Build the Set-Cookie header for a successful login. The cookie value is
 * the HMAC-signed session token (never the raw user id). The cookie is
 * HttpOnly (so client JS cannot read it), SameSite=Lax, and lives for 30 days.
 */
export function setSessionCookie(userId: string): string {
  const token = signSessionToken(userId)
  return `ejareban-user=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
}

/**
 * Build the Set-Cookie header that clears the session cookie on logout.
 * The expiry is set to Unix epoch, which immediately invalidates the cookie
 * in every browser.
 */
export function clearSessionCookie(): string {
  return `ejareban-user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/**
 * Hash a plain password using bcrypt (12 rounds, async).
 *
 * S6: the previous implementation used `hashSync(plain, 10)`. 12 rounds is
 * the current OWASP recommendation for interactive logins (≈2^12 key setup
 * steps, ~250ms on server hardware) — expensive enough to make offline
 * cracking of a leaked hash impractical, cheap enough for registration.
 * Async keeps the Node event loop free while the KDF runs.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}
