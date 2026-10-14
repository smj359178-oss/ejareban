import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapBooking } from '@/lib/mappers'
import { assertSameOrigin } from '@/lib/http'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // owner / admin can approve/decline a pending request
  PENDING: ['APPROVED', 'DECLINED', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED', 'DECLINED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
}

/**
 * PATCH /api/bookings/[id] — status transitions performed by owner/renter.
 *
 * 12-step flow gates (implemented here):
 *  - OWNER "APPROVED" (تأیید نهایی) requires the ADMIN review to be done
 *    first (adminApprovedAt stamped via /api/admin/bookings/[id]) — step 2
 *    before step 5.
 *  - OWNER "ACTIVE" (ثبت تحویل) requires paymentStatus=PAID — step 8 before
 *    step 10.
 *  - Decline/cancel releases availability rows AND decrements the listing's
 *    bookingsCount inside the same transaction (B7).
 *  - Notifications on every transition to BOTH the relevant parties (W2).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای این عملیات باید وارد شوید.' },
      { status: 401 },
    )
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const nextStatus = String(body.status || '')

  const booking = await db.booking.findUnique({
    where: { id },
    include: { listing: true, renter: true, owner: true },
  })
  if (!booking) {
    return NextResponse.json({ error: 'رزرو مورد نظر یافت نشد.' }, { status: 404 })
  }

  const isOwner = booking.ownerId === user.id
  const isRenter = booking.renterId === user.id
  const isAdmin = user.role === 'ADMIN'
  if (!isOwner && !isRenter && !isAdmin) {
    return NextResponse.json(
      { error: 'شما اجازهٔ انجام این عملیات را ندارید.' },
      { status: 403 },
    )
  }

  // Authorization by transition
  const allowed = ALLOWED_TRANSITIONS[booking.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: 'این تغییر وضعیت برای رزرو مجاز نیست.' },
      { status: 400 },
    )
  }
  if (
    (nextStatus === 'APPROVED' ||
      nextStatus === 'DECLINED' ||
      nextStatus === 'ACTIVE' ||
      nextStatus === 'COMPLETED') &&
    !isOwner &&
    !isAdmin
  ) {
    return NextResponse.json(
      { error: 'فقط مالک آگهی می‌تواند این کار را انجام دهد.' },
      { status: 403 },
    )
  }

  // --- Gate 1: owner's final approval needs the admin review first (step 2) ---
  if (nextStatus === 'APPROVED' && !isAdmin && !booking.adminApprovedAt) {
    return NextResponse.json(
      {
        error:
          'این رزرو هنوز توسط تیم اجاره‌بان بررسی نشده است. پس از تأیید ادمین می‌توانید تأیید نهایی را انجام دهید.',
      },
      { status: 409 },
    )
  }

  // --- Gate 2: delivery (ثبت تحویل) needs the payment first (step 8 → 10) ---
  if (nextStatus === 'ACTIVE' && booking.paymentStatus !== 'PAID') {
    return NextResponse.json(
      {
        error:
          'پیش از تحویل کالا، اجاره‌گیرنده باید پرداخت را انجام دهد (قرارداد امضا و مبلغ پرداخت شود).',
      },
      { status: 409 },
    )
  }

  const now = new Date()
  const updated = await db.$transaction(async (tx) => {
    const data: Prisma.BookingUpdateInput = { status: nextStatus }
    if (nextStatus === 'ACTIVE') data.deliveredAt = now
    if (nextStatus === 'DECLINED' || nextStatus === 'CANCELLED') {
      // Release held dates + keep the counter honest (B7).
      await tx.availability.deleteMany({
        where: { listingId: booking.listingId, bookingId: booking.id },
      })
      await tx.listing.update({
        where: { id: booking.listingId },
        data: { bookingsCount: { decrement: 1 } },
      })
    }
    return tx.booking.update({
      where: { id },
      data,
      include: { listing: true, renter: true, owner: true },
    })
  })

  // When approved, materialize availability blocks for the booked range.
  if (nextStatus === 'APPROVED') {
    const cur = new Date(booking.startDate)
    const end = new Date(booking.endDate)
    const rows: Prisma.AvailabilityCreateManyInput[] = []
    while (cur.getTime() <= end.getTime()) {
      rows.push({
        listingId: booking.listingId,
        date: new Date(cur),
        isBlocked: true,
        bookingId: booking.id,
        reason: 'booking',
      })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    if (rows.length) {
      await db.availability.deleteMany({
        where: {
          listingId: booking.listingId,
          date: { gte: booking.startDate, lte: booking.endDate },
        },
      })
      await db.availability.createMany({ data: rows })
    }
    // W2: the renter must hear «تأیید شد» — notify both sides.
    await db.notification.createMany({
      data: [
        {
          userId: booking.renterId,
          type: 'booking_approved',
          title: 'رزرو شما تأیید شد',
          body: `رزرو شما برای «${booking.listing.title}» توسط مالک تأیید شد. حالا قرارداد را امضا و پرداخت را انجام دهید.`,
          link: '/dashboard?tab=bookings',
        },
        {
          userId: booking.ownerId,
          type: 'booking_approved',
          title: 'تأیید نهایی ثبت شد',
          body: `شما رزرو «${booking.listing.title}» را تأیید کردید. منتظر امضا و پرداخت اجاره‌گیرنده باشید.`,
          link: '/dashboard?tab=bookings',
        },
      ],
    })
  }

  if (nextStatus === 'ACTIVE') {
    // Delivered — tell the renter the rental clock started.
    await db.notification.createMany({
      data: [
        {
          userId: booking.renterId,
          type: 'booking_delivered',
          title: 'کالا تحویل داده شد',
          body: `«${booking.listing.title}» به شما تحویل داده شد. اجاره از ${toPersianDigits(booking.days)} روز آغاز شد. پس از پایان، بازگشت را ثبت کنید.`,
          link: '/dashboard?tab=bookings',
        },
      ],
    })
  }

  if (nextStatus === 'DECLINED' || nextStatus === 'CANCELLED') {
    await db.notification.create({
      data: {
        userId: booking.renterId,
        type: 'booking_update',
        title:
          nextStatus === 'DECLINED'
            ? 'رزرو شما رد شد'
            : 'رزرو شما لغو شد',
        body:
          nextStatus === 'DECLINED'
            ? `رزرو شما برای «${booking.listing.title}» رد شد.`
            : `رزرو شما برای «${booking.listing.title}» لغو شد.`,
        link: '/dashboard?tab=bookings',
      },
    })
    if (nextStatus === 'CANCELLED') {
      // The owner should also know when someone cancels.
      await db.notification.create({
        data: {
          userId: booking.ownerId,
          type: 'booking_update',
          title: 'رزرو لغو شد',
          body: `رزرو «${booking.listing.title}» توسط ${isRenter ? 'اجاره‌گیرنده' : 'یک طرف'} لغو شد.`,
          link: '/dashboard?tab=bookings',
        },
      })
    }
  }

  return NextResponse.json({ booking: mapBooking(updated) })
}
