import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 *
 * Admin-only endpoint that returns every registered user with their public
 * profile + their listing/booking aggregates. This powers the "Users" tab
 * in the admin console so the admin can see who has registered and what
 * their activity looks like at a glance.
 *
 * Query params:
 *   ?role=USER|OWNER|ADMIN — filter by role
 *   ?q=needle             — case-insensitive search on name/email/username
 *   ?limit=100             — capped at 200, default 100
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 200)

  const where: {
    role?: string
    OR?: Array<{ [k: string]: { contains: string } }>
  } = {}
  if (role && ['USER', 'OWNER', 'ADMIN'].includes(role)) {
    where.role = role
  }
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
      { username: { contains: q } },
    ]
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      city: true,
      avatar: true,
      isIdentityVerified: true,
      isPhoneVerified: true,
      trustScore: true,
      trustTier: true,
      ratingSum: true,
      ratingCount: true,
      rentalsCompleted: true,
      createdAt: true,
    },
  })

  // Count listings & bookings for each user in a single aggregate pass.
  const counts = await Promise.all(
    users.map((u) =>
      Promise.all([
        db.listing.count({ where: { ownerId: u.id } }),
        db.booking.count({ where: { renterId: u.id } }),
      ]),
    ),
  )

  return NextResponse.json({
    users: users.map((u, i) => ({
      ...u,
      listingsCount: counts[i][0],
      bookingsAsRenter: counts[i][1],
    })),
  })
}
