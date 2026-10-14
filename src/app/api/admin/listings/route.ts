import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapListing } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // pending | approved | rejected | all
  const where = status && status !== 'all' ? { moderationStatus: status.toUpperCase() } : {}
  const listings = await db.listing.findMany({
    where,
    include: { category: true, owner: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  // Admin viewer → full detail (address/lat/lng included).
  return NextResponse.json({
    listings: listings.map((l) =>
      mapListing(l, { userId: user.id, isAdmin: true }),
    ),
  })
}
