import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats — REAL platform statistics for the homepage trust band (B3).
 *
 * The homepage previously showed hard-coded fake numbers («۱۲هزار+ آیتم»,
 * «۳۸هزار+ اجاره‌گیرنده») while the platform had a dozen listings. This
 * endpoint aggregates the actual DB counts. Numbers are shown as-is in
 * Persian digits — no inflation, no fake marketing multipliers.
 */
export async function GET() {
  const [totalListings, activeListings, totalUsers, completedRentals, reviewAgg] =
    await Promise.all([
      db.listing.count(),
      db.listing.count({ where: { status: 'ACTIVE', moderationStatus: 'APPROVED' } }),
      db.user.count(),
      db.booking.count({ where: { status: 'COMPLETED' } }),
      db.review.aggregate({ _count: { id: true } }),
    ])

  // Average listing rating across rated listings (0 when none) — computed
  // from ratingSum/ratingCount (Listing has no scalar `rating` column).
  const rated = await db.listing.aggregate({
    where: { ratingCount: { gt: 0 } },
    _sum: { ratingSum: true, ratingCount: true },
  })
  const ratedCount = rated._sum.ratingCount ?? 0
  const ratedSum = rated._sum.ratingSum ?? 0
  const averageRating =
    ratedCount > 0 ? Math.round((ratedSum / ratedCount) * 10) / 10 : 0

  return NextResponse.json({
    stats: {
      totalListings,
      activeListings,
      totalUsers,
      completedRentals,
      totalReviews: reviewAgg._count.id,
      averageRating,
      ratedListings: ratedCount,
    },
  })
}
