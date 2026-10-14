import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapReview } from '@/lib/mappers'
import { checkRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const listingId = searchParams.get('listingId')
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی الزامی است.' }, { status: 400 })
  }
  const reviews = await db.review.findMany({
    where: { listingId },
    include: { reviewer: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ reviews: reviews.map(mapReview) })
}

const Schema = z.object({
  listingId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(5).max(2000),
})

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای ثبت نظر باید وارد شوید.' },
      { status: 401 },
    )
  }
  // Rate limiting: anti-spam for review submission
  const rl = checkRateLimit(req, 'createReview', `user:${user.id}`)
  if (!rl.ok) return rl.response
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { listingId, rating, comment } = parsed.data

  const listing = await db.listing.findUnique({ where: { id: listingId } })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }

  // Integrity (bug 8 + W12): only users who ACTUALLY completed a rental on
  // this listing may review it — either as the RENTER (reviewing the item /
  // owner) or as the OWNER (reviewing the renter, two-way reviews).
  const completedBooking = await db.booking.findFirst({
    where: {
      listingId,
      status: 'COMPLETED',
      OR: [{ renterId: user.id }, { ownerId: user.id }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (!completedBooking) {
    return NextResponse.json(
      {
        error:
          'فقط طرف‌های یک اجارهٔ تکمیل‌شده می‌توانند نظر ثبت کنند (اجاره‌گیرنده یا مالک).',
      },
      { status: 403 },
    )
  }

  // One review per (user, listing)
  const existing = await db.review.findFirst({
    where: { listingId, reviewerId: user.id },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'شما قبلاً برای این آگهی نظر ثبت کرده‌اید.' },
      { status: 400 },
    )
  }

  // Two-way reviews (W12): the reviewee is the OTHER party of the rental —
  // renters rate the owner, owners rate the renter.
  const isOwnerReviewer = user.id === listing.ownerId
  const revieweeId = isOwnerReviewer
    ? (await db.booking.findFirst({
        where: { id: completedBooking.id },
        select: { renterId: true },
      }))?.renterId ?? listing.ownerId
    : listing.ownerId

  const review = await db.review.create({
    data: {
      listingId,
      bookingId: completedBooking.id,
      reviewerId: user.id,
      revieweeId,
      rating,
      comment,
    },
    include: { reviewer: true },
  })

  // Update listing + reviewee aggregates server-side (tamper-proof).
  // The reviewee is the other party of the rental (owner OR renter).
  const [aggL, aggR] = await Promise.all([
    db.review.aggregate({ where: { listingId }, _sum: { rating: true }, _count: true }),
    db.review.aggregate({ where: { revieweeId }, _sum: { rating: true }, _count: true }),
  ])
  await db.listing.update({
    where: { id: listingId },
    data: {
      ratingSum: aggL._sum.rating || 0,
      ratingCount: aggL._count,
    },
  })
  await db.user.update({
    where: { id: revieweeId },
    data: {
      ratingSum: aggR._sum.rating || 0,
      ratingCount: aggR._count,
    },
  })

  // Notify the reviewed party.
  await db.notification.create({
    data: {
      userId: revieweeId,
      type: 'review_received',
      title: 'نظر جدید برای شما ثبت شد',
      body: `کاربر ${user.name} برای همکاری در «${listing.title}» امتیاز ${rating} از ۵ ثبت کرد.`,
      link: `/dashboard?tab=bookings`,
    },
  })

  return NextResponse.json({ review: mapReview(review) }, { status: 201 })
}
