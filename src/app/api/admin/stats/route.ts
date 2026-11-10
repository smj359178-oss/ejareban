import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }
  const [
    totalUsers,
    owners,
    totalListings,
    pendingListings,
    activeListings,
    totalBookings,
    pendingBookings,
    revenueRows,
    openReports,
    pendingVerifications,
    recentBookings,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: 'OWNER' } }),
    db.listing.count(),
    db.listing.count({ where: { moderationStatus: 'PENDING' } }),
    db.listing.count({ where: { status: 'ACTIVE', moderationStatus: 'APPROVED' } }),
    db.booking.count(),
    db.booking.count({ where: { status: 'PENDING' } }),
    // Net money math (B8): REFUNDED bookings were paid and then reimbursed,
    // so their fees must be subtracted from the PAID totals. Counting only
    // PAID would overstate revenue after any refund.
    db.booking.groupBy({
      by: ['paymentStatus'],
      where: { paymentStatus: { in: ['PAID', 'REFUNDED'] } },
      _sum: { rentalPrice: true, serviceFee: true },
    }),
    db.report.count({ where: { status: 'OPEN' } }),
    db.verificationRequest.count({ where: { status: 'PENDING' } }),
    db.booking.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { listing: true, renter: true },
    }),
  ])

  const paidRow = revenueRows.find((r) => r.paymentStatus === 'PAID')
  const refundedRow = revenueRows.find((r) => r.paymentStatus === 'REFUNDED')
  const platformRevenue =
    (paidRow?._sum.serviceFee ?? 0) - (refundedRow?._sum.serviceFee ?? 0)
  const gmv =
    (paidRow?._sum.rentalPrice ?? 0) - (refundedRow?._sum.rentalPrice ?? 0)

  return NextResponse.json({
    stats: {
      totalUsers,
      owners,
      totalListings,
      pendingListings,
      activeListings,
      totalBookings,
      pendingBookings,
      openReports,
      pendingVerifications,
      platformRevenue,
      gmv,
    },
    recentBookings: recentBookings.map((b) => ({
      id: b.id,
      title: b.listing.title,
      renter: b.renter.name,
      days: b.days,
      total: b.totalAmount,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}
