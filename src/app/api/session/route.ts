import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/session
 *
 * Returns the currently authenticated user, or `{ user: null }` for anonymous
 * visitors. Used by the client `useSession()` hook on page load.
 *
 * For historical reasons this endpoint still exists alongside
 * /api/auth/me — both return the same shape. The navbar / useSession hook
 * reads from this one; the auth pages and middleware read from /api/auth/me.
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  return NextResponse.json({ user })
}
