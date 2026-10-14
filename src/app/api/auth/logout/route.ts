import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and returns 200. The caller can ignore the body
 * and just redirect to /login or /.
 */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', clearSessionCookie())
  return res
}
