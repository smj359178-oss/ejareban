import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapBooking } from '@/lib/mappers'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/bookings/[id] — admin triage actions on a booking (W1).
 *
 * Lifecycle role of the admin (step 2 of the 12-step flow):
 *  - action "review-approve": stamps `adminApprovedAt` (booking stays PENDING
 *    until the OWNER gives the final approval — but the owner is unlocked),
 *    and notifies BOTH the renter and the owner (W13: previously the renter
 *    never heard anything from the admin side).
 *  - action "decline": booking → DECLINED, availability released, both
 *    parties notified.
 *  - action "cancel": booking → CANCELLED (post-approval cancellation by
 *    admin), availability released, both parties notified.
 *
 * Every action is audit-logged.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  const note = typeof body.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, 500)
    : null

  const booking = await db.booking.findUnique({
    where: { id },
    include: { listing: true, renter: true, owner: true },
  })
  if (!booking) {
    return NextResponse.json({ error: 'رزرو مورد نظر یافت نشد.' }, { status: 404 })
  }

  const listingTitle = booking.listing.title

  async function notify(userId: string, type: string, title: string, bodyText: string) {
    await db.notification.create({
      data: { userId, type, title, body: bodyText, link: '/dashboard?tab=bookings' },
    })
  }

  if (action === 'review-approve') {
    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'فقط رزروهای در انتظار بررسی قابل تأیید ادمین هستند.' },
        { status: 400 },
      )
    }
    if (booking.adminApprovedAt) {
      return NextResponse.json(
        { error: 'این رزرو قبلاً توسط ادمین بررسی شده است.' },
        { status: 400 },
      )
    }

    const updated = await db.$transaction(async (tx) => {
      return tx.booking.update({
        where: { id },
        data: { adminApprovedAt: new Date(), adminNote: note },
        include: { listing: true, renter: true, owner: true },
      })
    })

    // W13 — notify BOTH parties, not just the owner.
    await notify(
      booking.renterId,
      'booking_admin_reviewed',
      'رزرو شما توسط ادمین بررسی شد',
      `رزرو شما برای «${listingTitle}» توسط تیم اجاره‌بان بررسی و تأیید اولیه شد. منتظر تأیید نهایی مالک باشید.`,
    )
    await notify(
      booking.ownerId,
      'booking_admin_reviewed',
      'رزرو جدید قابل تأیید نهایی است',
      `رزرو برای «${listingTitle}» توسط ادمین بررسی شد. در صورت تمایل، تأیید نهایی را انجام دهید.`,
    )
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: 'BOOKING_ADMIN_APPROVED',
        targetType: 'Booking',
        targetId: id,
        metadata: JSON.stringify({ note }),
      },
    })

    return NextResponse.json({ booking: mapBooking(updated) })
  }

  if (action === 'decline' || action === 'cancel') {
    const nextStatus = action === 'decline' ? 'DECLINED' : 'CANCELLED'
    if (!['PENDING', 'APPROVED'].includes(booking.status)) {
      return NextResponse.json(
        { error: 'این وضعیت رزرو قابل لغو/رد توسط ادمین نیست.' },
        { status: 400 },
      )
    }

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.booking.update({
        where: { id },
        data: { status: nextStatus, cancellationReason: note ?? 'لغو توسط ادمین' },
        include: { listing: true, renter: true, owner: true },
      })
      // Release any availability rows held by this booking.
      await tx.availability.deleteMany({
        where: { listingId: booking.listingId, bookingId: booking.id },
      })
      // Keep the listing's bookingsCount honest (B7).
      await tx.listing.update({
        where: { id: booking.listingId },
        data: { bookingsCount: { decrement: 1 } },
      })
      return u
    })

    const title =
      nextStatus === 'DECLINED' ? 'رزرو رد شد' : 'رزرو لغو شد'
    const bodyRenter = `رزرو شما برای «${listingTitle}» ${nextStatus === 'DECLINED' ? 'توسط تیم اجاره‌بان رد شد' : 'توسط تیم اجاره‌بان لغو شد'}.${note ? ` دلیل: ${note}` : ''}`
    const bodyOwner = `رزرو «${listingTitle}» ${nextStatus === 'DECLINED' ? 'توسط تیم اجاره‌بان رد شد' : 'توسط تیم اجاره‌بان لغو شد'}.${note ? ` دلیل: ${note}` : ''}`
    await notify(booking.renterId, 'booking_update', title, bodyRenter)
    await notify(booking.ownerId, 'booking_update', title, bodyOwner)
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: nextStatus === 'DECLINED' ? 'BOOKING_ADMIN_DECLINED' : 'BOOKING_ADMIN_CANCELLED',
        targetType: 'Booking',
        targetId: id,
        metadata: JSON.stringify({ note }),
      },
    })

    return NextResponse.json({ booking: mapBooking(updated) })
  }

  return NextResponse.json(
    { error: 'عملیات ارسالی معتبر نیست. (review-approve | decline | cancel)' },
    { status: 400 },
  )
}
