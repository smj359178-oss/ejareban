import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/http'
import { mapBooking } from '@/lib/mappers'
import { resolveBookingActor, notifyUser, readJson } from '@/lib/booking-flow'
import { serializeImages } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/[id]/return — item return flow (W8, step 11).
 *
 * Previously the only way out of ACTIVE was a bare `PATCH {status:COMPLETED}`
 * with no record of the hand-back. This endpoint documents the return:
 *
 *   - owner or renter may submit while the booking is ACTIVE
 *   - body: { note?: string, images?: string[] } — description + photos of
 *     the returned item condition
 *   - status → COMPLETED, returnedAt stamped, note/images stored
 *   - the other party is notified; the deposit-refund step (W7) becomes
 *     available in the dashboard
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

  if (booking.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'ثبت بازگشت فقط برای اجاره‌های در جریان (در حال اجاره) فعال است.' },
      { status: 400 },
    )
  }

  const body = await readJson(req)
  const note =
    typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 2000)
      : null
  const images = Array.isArray(body.images)
    ? body.images.filter((x): x is string => typeof x === 'string').slice(0, 8)
    : []

  const submitterRole = isOwner ? 'مالک' : 'اجاره‌گیرنده'

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        returnedAt: new Date(),
        returnNote: note,
        returnImages: images.length ? serializeImages(images) : null,
      },
      include: { listing: true, renter: true, owner: true },
    })
    // Release the availability blocks held by this booking (B7 hygiene).
    await tx.availability.deleteMany({
      where: { listingId: booking.listingId, bookingId: booking.id },
    })
    return u
  }, { timeout: 20000 })

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'BOOKING_RETURNED',
      targetType: 'Booking',
      targetId: id,
      metadata: JSON.stringify({ role: submitterRole, hasImages: images.length > 0 }),
    },
  })

  const otherId = isOwner ? booking.renterId : booking.ownerId
  await notifyUser(
    otherId,
    'booking_returned',
    'بازگشت کالا ثبت شد',
    `${submitterRole} بازگشت «${booking.listing.title}» را ثبت کرد.${note ? ` توضیح: ${note}` : ''} ودیعه قابل بازگشت است.`,
  )
  await notifyUser(
    isOwner ? booking.ownerId : booking.renterId,
    'booking_returned',
    'بازگشت کالا ثبت شد',
    `بازگشت «${booking.listing.title}» ثبت شد. می‌توانید ودیعه را بازگردانید.`,
  )

  return NextResponse.json({ booking: mapBooking(updated) })
}
