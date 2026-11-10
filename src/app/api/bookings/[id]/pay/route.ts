import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/http'
import { mapBooking } from '@/lib/mappers'
import { resolveBookingActor, notifyUser, readJson } from '@/lib/booking-flow'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/[id]/pay — simulated payment (W5, step 8).
 *
 * `paymentStatus` used to be stuck at PENDING forever. This endpoint lets
 * the RENTER pay once the contract is signed by both parties:
 *
 *   guard chain: renter only → status APPROVED → both signatures → not paid yet
 *
 * Effects:
 *   - paymentStatus → PAID, paidAt stamped
 *   - Transaction rows: RENTAL_PAYMENT (rental + service + delivery) and
 *     DEPOSIT_HOLD (the deposit is now held by the platform)
 *   - owner notified
 *
 * The method is SIMULATED — swapping in Zarinpal later only replaces the
 * `method` + gateway reference; the state machine stays identical.
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
  const { booking, user, isRenter } = ctx

  if (!isRenter) {
    return NextResponse.json(
      { error: 'پرداخت فقط توسط اجاره‌گیرنده انجام می‌شود.' },
      { status: 403 },
    )
  }
  if (booking.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'پرداخت فقط برای رزروهای تأییدشده فعال است.' },
      { status: 400 },
    )
  }
  if (!booking.ownerSignedAt || !booking.renterSignedAt) {
    return NextResponse.json(
      { error: 'پیش از پرداخت، قرارداد باید توسط هر دو طرف امضا شود.' },
      { status: 400 },
    )
  }
  if (booking.paymentStatus === 'PAID') {
    return NextResponse.json(
      { error: 'این رزرو قبلاً پرداخت شده است.' },
      { status: 400 },
    )
  }

  const body = await readJson(req)
  const reference =
    typeof body.reference === 'string' && body.reference.trim()
      ? body.reference.trim().slice(0, 100)
      : `SIM-${Date.now().toString(36).toUpperCase()}`

  const now = new Date()
  const rentalAmount = booking.rentalPrice + booking.serviceFee + booking.deliveryFee

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.booking.update({
      where: { id },
      data: { paymentStatus: 'PAID', paidAt: now },
      include: { listing: true, renter: true, owner: true },
    })
    await tx.transaction.createMany({
      data: [
        {
          bookingId: booking.id,
          userId: booking.renterId,
          type: 'RENTAL_PAYMENT',
          amount: rentalAmount,
          status: 'COMPLETED',
          method: 'SIMULATED',
          reference,
          note: `پرداخت اجارهٔ «${booking.listing.title}» (${booking.days} روز)`,
        },
        {
          bookingId: booking.id,
          userId: booking.renterId,
          type: 'DEPOSIT_HOLD',
          amount: booking.depositTotal,
          status: 'COMPLETED',
          method: 'SIMULATED',
          reference,
          note: 'ودیعه (نزد پلتفرم نگهداری می‌شود)',
        },
      ],
    })
    return u
  }, { timeout: 20000 })

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'BOOKING_PAID',
      targetType: 'Booking',
      targetId: id,
      metadata: JSON.stringify({ reference, rentalAmount, deposit: booking.depositTotal }),
    },
  })

  await notifyUser(
    booking.ownerId,
    'booking_paid',
    'اجاره‌گیرنده پرداخت را انجام داد',
    `مبلغ رزرو «${booking.listing.title}» پرداخت شد. کالا را آمادهٔ تحویل کنید.`,
  )
  await notifyUser(
    booking.renterId,
    'booking_paid',
    'پرداخت با موفقیت انجام شد',
    `پرداخت شما برای «${booking.listing.title}» ثبت شد. هماهنگی تحویل را از طریق پیام‌ها انجام دهید.`,
  )

  return NextResponse.json({ booking: mapBooking(updated) })
}
