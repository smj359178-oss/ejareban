import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapBooking } from '@/lib/mappers'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = [
  'ALL',
  'PENDING',
  'APPROVED',
  'ACTIVE',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
] as const

/**
 * GET /api/admin/bookings — full bookings list for the admin console (W1).
 *
 * The admin bookings tab previously rendered only the last 6 rows embedded
 * in /api/admin/stats with zero actions. This endpoint returns every booking
 * with paging + a status filter so admins can actually triage requests.
 *
 * Query: ?status=PENDING|APPROVED|...|ALL&page=1&limit=25
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }

  const rl = checkRateLimit(req, 'search', `admin-bookings:${user.id}`)
  if (!rl.ok) return rl.response

  const { searchParams } = new URL(req.url)
  const statusParam = (searchParams.get('status') || 'ALL').toUpperCase()
  const status = (VALID_STATUSES as readonly string[]).includes(statusParam)
    ? statusParam
    : 'ALL'
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 100)

  const where = status !== 'ALL' ? { status } : {}
  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: { listing: true, renter: true, owner: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({
    bookings: rows.map(mapBooking),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  })
}
