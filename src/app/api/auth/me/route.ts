import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/me
 *
 * Returns the currently logged-in user, or 401 if anonymous. This is the
 * canonical endpoint for the client to fetch the session after a page reload.
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({ user })
}
