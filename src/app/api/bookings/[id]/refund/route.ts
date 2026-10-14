import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/http'
import { mapBooking } from '@/lib/mappers'
import { resolveBookingActor, notifyUser, readJson } from '@/lib/booking-flow'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/[id]/refund — deposit refund (+ damage claim) (W7/W9).
 *
 * The deposit used to vanish into `depositTotal` forever. Now, after the
 * item is returned (COMPLETED), the OWNER (or an admin) settles the deposit:
 *
 *   body: { damageNote?: string, damageAmount?: number }
 *
 *   - damageAmount defaults to 0; it is clamped to [0, depositTotal]
 *   - refund = depositTotal − damageAmount
 *   - rows: DEPOSIT_REFUND (refund to renter) + DAMAGE_DEDUCTION (when > 0)
 *   - renter is notified with the exact amounts and the damage note
 *
 * `paymentStatus` flips to REFUNDED when the deposit has been returned and
 * the rental was paid — the full financial picture stays in Transaction.
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

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: 'بازگرداندن ودیعه فقط توسط مالک (یا ادمین) انجام می‌شود.' },
      { status: 403 },
    )
  }
  if (booking.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'ودیعه فقط پس از ثبت بازگشت کالا قابل بازگشت است.' },
      { status: 400 },
    )
  }
  if (booking.depositRefundedAt) {
    return NextResponse.json(
      { error: 'ودیعهٔ این رزرو قبلاً بازگردانده شده است.' },
      { status: 400 },
    )
  }
  if (booking.depositTotal <= 0) {
    return NextResponse.json(
      { error: 'این رزرو ودیعه‌ای ندارد.' },
      { status: 400 },
    )
  }

  const body = await readJson(req)
  const rawDamage = Number(body.damageAmount ?? 0)
  const damageAmount =
    Number.isFinite(rawDamage) && rawDamage > 0
      ? Math.min(Math.round(rawDamage), booking.depositTotal)
      : 0
  const damageNote =
    typeof body.damageNote === 'string' && body.damageNote.trim()
      ? body.damageNote.trim().slice(0, 1000)
      : null
  if (damageAmount > 0 && !damageNote) {
    return NextResponse.json(
      { error: 'برای کسر از ودیعه، توضیح خسارت الزامی است.' },
      { status: 400 },
    )
  }

  const refundAmount = booking.depositTotal - damageAmount
  const now = new Date()

  const updated = await db.$transaction(async (tx) => {
    const rows: {
      bookingId: string
      userId: string
      type: string
      amount: number
      status: string
      method: string
      note?: string
    }[] = [
      {
        bookingId: booking.id,
        userId: booking.renterId,
        type: 'DEPOSIT_REFUND',
        amount: refundAmount,
        status: refundAmount > 0 ? 'COMPLETED' : 'FAILED',
        method: 'SIMULATED',
        note: `بازگشت ودیعهٔ «${booking.listing.title}»`,
      },
    ]
    if (damageAmount > 0) {
      rows.push({
        bookingId: booking.id,
        userId: booking.renterId,
        type: 'DAMAGE_DEDUCTION',
        amount: damageAmount,
        status: 'COMPLETED',
        method: 'SIMULATED',
        note: damageNote ?? undefined,
      })
    }
    await tx.transaction.createMany({ data: rows })

    const u = await tx.booking.update({
      where: { id },
      data: {
        depositRefundedAt: now,
        depositRefundAmount: refundAmount,
        damageAmount: damageAmount > 0 ? damageAmount : null,
        damageNote: damageAmount > 0 ? damageNote : null,
        paymentStatus: booking.paymentStatus === 'PAID' ? 'REFUNDED' : booking.paymentStatus,
      },
      include: { listing: true, renter: true, owner: true },
    })
    return u
  }, { timeout: 20000 })

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'DEPOSIT_REFUNDED',
      targetType: 'Booking',
      targetId: id,
      metadata: JSON.stringify({ refundAmount, damageAmount, damageNote }),
    },
  })

  await notifyUser(
    booking.renterId,
    'deposit_refunded',
    'ودیعه بازگردانده شد',
    damageAmount > 0
      ? `ودیعهٔ رزرو «${booking.listing.title}» با کسر خسارت (${damageAmount.toLocaleString('fa-IR')} تومان) بازگردانده شد. مبلغ دریافتی: ${refundAmount.toLocaleString('fa-IR')} تومان. توضیح مالک: ${damageNote}`
      : `ودیعهٔ رزرو «${booking.listing.title}» به‌طور کامل بازگردانده شد (${refundAmount.toLocaleString('fa-IR')} تومان).`,
  )

  return NextResponse.json({ booking: mapBooking(updated) })
}
