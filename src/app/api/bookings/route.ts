import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapBooking } from '@/lib/mappers'
import { checkRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'
import { toPersianDigits } from '@/lib/persian'
import {
  computePrice,
  enumerateDays,
  rentalDays,
  startOfDateUTC,
} from '@/lib/availability'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  listingId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  deliveryOption: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  message: z.string().max(2000).optional(),
})

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ error: 'برای رزرو باید وارد شوید.' }, { status: 401 })
  }
  // Bookings where the user is renter OR owner
  const bookings = await db.booking.findMany({
    where: { OR: [{ renterId: user.id }, { ownerId: user.id }] },
    include: { listing: true, renter: true, owner: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ bookings: bookings.map(mapBooking) })
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ error: 'برای رزرو باید وارد شوید.' }, { status: 401 })
  }
  // Rate limiting: anti-spam for booking creation
  const rl = checkRateLimit(req, 'createBooking', `user:${user.id}`)
  if (!rl.ok) return rl.response
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { listingId, startDate, endDate, deliveryOption, message } = parsed.data

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { owner: true },
  })
  if (!listing || listing.status !== 'ACTIVE' || listing.moderationStatus !== 'APPROVED') {
    return NextResponse.json(
      { error: 'این آگهی در حال حاضر قابل رزرو نیست.' },
      { status: 400 },
    )
  }
  if (listing.ownerId === user.id) {
    return NextResponse.json(
      { error: 'نمی‌توانید کالای خودتان را اجاره بگیرید.' },
      { status: 400 },
    )
  }

  const start = startOfDateUTC(new Date(startDate))
  const end = startOfDateUTC(new Date(endDate))
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'بازهٔ تاریخ نامعتبر است.' }, { status: 400 })
  }
  const days = rentalDays(start, end)
  if (days < listing.minRentalDays) {
    return NextResponse.json(
      { error: `حداقل مدت اجاره ${toPersianDigits(listing.minRentalDays)} روز است.` },
      { status: 400 },
    )
  }
  if (listing.maxRentalDays && days > listing.maxRentalDays) {
    return NextResponse.json(
      { error: `حداکثر مدت اجاره ${toPersianDigits(listing.maxRentalDays)} روز است.` },
      { status: 400 },
    )
  }

  // ---- Double-booking prevention: conflict check + create in a transaction ----
  // Serializable isolation guarantees that two concurrent bookings on the
  // same date range cannot both succeed. On PostgreSQL we will use
  // SELECT FOR UPDATE; on SQLite a serial transaction gives the same guarantee.
  const price = computePrice({
    dailyPrice: listing.dailyPrice,
    weeklyPrice: listing.weeklyPrice,
    monthlyPrice: listing.monthlyPrice,
    deposit: listing.deposit,
    deliveryFee: listing.deliveryFee,
    deliveryAvailable: listing.deliveryAvailable,
    days,
    deliveryOption,
  })

  const daysToCheck = enumerateDays(start, end)

  let booking
  try {
    booking = await db.$transaction(
      async (tx) => {
        // Row-level lock: check for conflicts inside the transaction
        const conflicts = await tx.booking.findFirst({
          where: {
            listingId,
            status: { in: ['APPROVED', 'ACTIVE', 'PENDING'] },
            OR: daysToCheck.flatMap((d) => {
              const day = new Date(`${d}T00:00:00.000Z`)
              return [{ startDate: { lte: day }, endDate: { gte: day } }]
            }),
          },
          select: { id: true },
        })
        if (conflicts) {
          throw new Error('CONFLICT')
        }
        // Create the booking inside the same transaction + keep the
        // listing's bookingsCount honest (B7 — the counter used to never
        // update because it was never touched anywhere).
        const created = await tx.booking.create({
          data: {
            listingId,
            renterId: user.id,
            ownerId: listing.ownerId,
            startDate: start,
            endDate: end,
            days,
            pricingTier: price.pricingTier,
            dailyRate: price.dailyRate,
            rentalPrice: price.rentalPrice,
            depositTotal: price.depositTotal,
            deliveryFee: price.deliveryFee,
            serviceFee: price.serviceFee,
            discount: price.discount,
            totalAmount: price.totalAmount,
            message: message ?? null,
            deliveryOption,
            status: 'PENDING',
            paymentStatus: 'PENDING',
          },
          include: { listing: true, renter: true, owner: true },
        })
        await tx.listing.update({
          where: { id: listingId },
          data: { bookingsCount: { increment: 1 } },
        })
        return created
      },
      {
        isolationLevel: 'Serializable',
        timeout: 10000,
      },
    )
  } catch (e) {
    if (e instanceof Error && e.message === 'CONFLICT') {
      return NextResponse.json(
        { error: 'تاریخ‌های انتخاب‌شده با رزرو موجود هم‌پوشانی دارند. لطفاً تاریخ دیگری انتخاب کنید.' },
        { status: 409 },
      )
    }
    // Never leak a raw 500 / stack trace to the client (bug 11).
    console.error('[bookings] transaction failed:', e)
    return NextResponse.json(
      { error: 'خطای غیرمنتظره در سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    )
  }

  // Notify the owner (W2) AND every admin — the 12-step flow starts with an
  // admin review, so admins must learn about the request (W13/step 1).
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  const notificationRows = [
    {
      userId: listing.ownerId,
      type: 'booking_request',
      title: 'درخواست رزرو جدید',
      body: `${user.name} درخواست اجارهٔ «${listing.title}» برای ${toPersianDigits(days)} روز داد.`,
      link: '/dashboard?tab=bookings',
    },
    ...admins.map((a) => ({
      userId: a.id,
      type: 'booking_request_admin',
      title: 'رزرو جدید در انتظار بررسی',
      body: `${user.name} درخواست اجارهٔ «${listing.title}» را ثبت کرد. در پنل مدیریت بررسی کنید.`,
      link: '/admin?tab=bookings',
    })),
  ]
  await db.notification.createMany({ data: notificationRows })

  return NextResponse.json({ booking: mapBooking(booking) }, { status: 201 })
}
