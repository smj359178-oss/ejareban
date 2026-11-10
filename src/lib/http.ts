/**
 * Small HTTP-level security helpers shared by all API routes.
 */

/**
 * CSRF / Origin check (bug 6).
 *
 * Browser `fetch`/XHR POST/PATCH/DELETE/PUT requests always carry an `Origin`
 * header. Cross-site requests (CSRF) will carry a foreign origin, so we
 * compare the Origin host against the server's own host (`Host` header, or
 * `x-forwarded-host` when running behind a proxy such as Caddy).
 *
 * Rules:
 *  - No `Origin` header (curl, server-to-server, tests) → allowed.
 *  - Origin present and its host matches Host or x-forwarded-host → allowed.
 *  - Origin present and mismatched → NOT allowed (caller returns 403).
 *
 * Usage in every mutating handler (POST/PATCH/DELETE/PUT):
 *   if (!assertSameOrigin(req)) {
 *     return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
 *   }
 */
export function assertSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // non-browser client — nothing to compare

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false // malformed Origin header
  }

  // Behind a proxy the internal `Host` can differ from the public one, so
  // both are accepted.
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = req.headers.get('host')

  if (forwardedHost && originHost === forwardedHost.split(',')[0].trim()) {
    return true
  }
  if (host && originHost === host) {
    return true
  }
  return false
}
