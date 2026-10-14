import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/http'
import { mapBooking } from '@/lib/mappers'
import { resolveBookingActor, notifyUser, readJson } from '@/lib/booking-flow'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/[id]/settle — payout to the owner (W6, step 9).
 *
 * Money used to stop at the platform. This endpoint closes the loop: an
 * ADMIN (or, in this MVP, the owner confirming receipt) settles the rental
 * earnings to the owner:
 *
 *   guards: status COMPLETED → not already settled → rental was actually paid
 *   effects: settledAt stamped + OWNER_PAYOUT transaction + notification
 *
 * Payout = rentalPrice + deliveryFee (the 7% service fee is platform revenue).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const { id } = await params
  const ctx = await resolveBookingActor(req, id)
  if ('error' in ctx) return ctx.error
  const { booking, user, isOwner, isAdmin } = ctx

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: 'تسویه فقط توسط ادمین یا مالک انجام می‌شود.' },
      { status: 403 },
    )
  }
  if (booking.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'تسویه فقط پس از بازگشت کالا (تکمیل اجاره) امکان‌پذیر است.' },
      { status: 400 },
    )
  }
  if (booking.settledAt) {
    return NextResponse.json(
      { error: 'این رزرو قبلاً تسویه شده است.' },
      { status: 400 },
    )
  }
  if (booking.paymentStatus !== 'PAID' && booking.paymentStatus !== 'REFUNDED') {
    return NextResponse.json(
      { error: 'چون اجاره‌گیرنده هنوز پرداختی انجام نداده، مبلغی برای تسویه وجود ندارد.' },
      { status: 400 },
    )
  }

  const body = await readJson(req)
  const reference =
    typeof body.reference === 'string' && body.reference.trim()
      ? body.reference.trim().slice(0, 100)
      : `PAYOUT-${Date.now().toString(36).toUpperCase()}`

  // Owner receives rental + delivery; the service fee stays with the platform.
  const payoutAmount = booking.rentalPrice + booking.deliveryFee

  const updated = await db.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        bookingId: booking.id,
        userId: booking.ownerId,
        type: 'OWNER_PAYOUT',
        amount: payoutAmount,
        status: 'COMPLETED',
        method: 'SIMULATED',
        reference,
        note: `تسویهٔ اجارهٔ «${booking.listing.title}» به مالک`,
      },
    })
    const u = await tx.booking.update({
      where: { id },
      data: { settledAt: new Date() },
      include: { listing: true, renter: true, owner: true },
    })
    return u
  }, { timeout: 20000 })

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'OWNER_PAYOUT_SETTLED',
      targetType: 'Booking',
      targetId: id,
      metadata: JSON.stringify({ payoutAmount, reference }),
    },
  })

  await notifyUser(
    booking.ownerId,
    'payout_settled',
    'تسویهٔ اجاره انجام شد',
    `مبلغ ${payoutAmount.toLocaleString('fa-IR')} تومان بابت اجارهٔ «${booking.listing.title}» به حساب شما واریز شد.`,
  )

  return NextResponse.json({ booking: mapBooking(updated) })
}
