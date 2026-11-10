import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/http'
import { mapBooking } from '@/lib/mappers'
import {
  resolveBookingActor,
  notifyUser,
  readJson,
} from '@/lib/booking-flow'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/[id]/sign — digital contract signature (W4, step 7).
 *
 * The contract PDF already existed, but nothing ever flipped
 * `contractSigned` — it was permanently false. Now BOTH parties must sign:
 *
 *   ownerSignedAt  — stamped when the owner calls this endpoint
 *   renterSignedAt — stamped when the renter calls this endpoint
 *   contractSigned — true only when BOTH timestamps exist
 *
 * Allowed once the booking is APPROVED (admin review + owner approval done).
 * When the second party signs, the other side is notified so the payment
 * step can begin. Every signature is audit-logged.
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
  const { booking, user, isOwner, isRenter } = ctx

  if (booking.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'امضای قرارداد فقط بعد از تأیید نهایی رزرو امکان‌پذیر است.' },
      { status: 400 },
    )
  }

  const body = await readJson(req)
  // Require an explicit acceptance — an empty body must not count as a
  // signature (B14).
  const accept = body.accept === true
  if (!accept) {
    return NextResponse.json(
      { error: 'برای امضا باید شرایط قرارداد را بپذیرید.' },
      { status: 400 },
    )
  }

  const now = new Date()
  const alreadySigned =
    (isOwner && booking.ownerSignedAt) || (isRenter && booking.renterSignedAt)
  if (alreadySigned) {
    return NextResponse.json(
      { error: 'شما قبلاً این قرارداد را امضا کرده‌اید.' },
      { status: 400 },
    )
  }

  const data = isOwner
    ? { ownerSignedAt: now }
    : isRenter
      ? { renterSignedAt: now }
      : {}
  // Admin signing is not part of the flow — reject explicitly.
  if (!isOwner && !isRenter) {
    return NextResponse.json(
      { error: 'فقط مالک یا اجاره‌گیرنده می‌تواند قرارداد را امضا کند.' },
      { status: 403 },
    )
  }

  const updated = await db.$transaction(async (tx) => {
    // Atomic guard (B14): the updateMany below flips the party's flag from
    // null → now only once. Concurrent duplicate requests get count 0 and
    // cannot stamp the signature twice or double-notify.
    const cond = isOwner
      ? { id, ownerSignedAt: null }
      : { id, renterSignedAt: null }
    const res = await tx.booking.updateMany({ where: cond, data })
    if (res.count === 0) {
      throw new Error('ALREADY_SIGNED')
    }
    const u = await tx.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: true, renter: true, owner: true },
    })
    // Flip the flag inside the same transaction when both signatures exist.
    const contractSigned = !!(u.ownerSignedAt && u.renterSignedAt)
    if (contractSigned !== u.contractSigned) {
      return tx.booking.update({
        where: { id },
        data: { contractSigned },
        include: { listing: true, renter: true, owner: true },
      })
    }
    return u
  }, { timeout: 20000 }).catch((e: unknown) => {
    if (e instanceof Error && e.message === 'ALREADY_SIGNED') {
      return NextResponse.json(
        { error: 'شما قبلاً این قرارداد را امضا کرده‌اید.' },
        { status: 400 },
      )
    }
    throw e
  })

  // The transaction may have returned a NextResponse (duplicate signature);
  // short-circuit before touching notifications/audit.
  if (updated instanceof NextResponse) {
    return updated
  }

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'CONTRACT_SIGNED',
      targetType: 'Booking',
      targetId: id,
      metadata: JSON.stringify({ role: isOwner ? 'OWNER' : 'RENTER' }),
    },
  })

  const bothSigned = !!(updated.ownerSignedAt && updated.renterSignedAt)
  if (bothSigned) {
    // Everyone can proceed to payment — notify the renter (and owner echo).
    await notifyUser(
      booking.renterId,
      'contract_signed',
      'قرارداد امضا شد — آمادهٔ پرداخت',
      `قرارداد رزرو «${booking.listing.title}» توسط هر دو طرف امضا شد. برای نهایی شدن اجاره، مبلغ را پرداخت کنید.`,
    )
    await notifyUser(
      booking.ownerId,
      'contract_signed',
      'قرارداد امضا شد',
      `قرارداد رزرو «${booking.listing.title}» توسط هر دو طرف امضا شد. منتظر پرداخت اجاره‌گیرنده باشید.`,
    )
  } else {
    // Ask the OTHER party to sign.
    const otherId = isOwner ? booking.renterId : booking.ownerId
    const signerRole = isOwner ? 'مالک' : 'اجاره‌گیرنده'
    await notifyUser(
      otherId,
      'contract_pending_signature',
      'قرارداد در انتظار امضای شما',
      `«${signerRole}» قرارداد رزرو «${booking.listing.title}» را امضا کرد. لطفاً وارد داشبورد شوید و قرارداد را امضا کنید.`,
    )
  }

  return NextResponse.json({ booking: mapBooking(updated) })
}
