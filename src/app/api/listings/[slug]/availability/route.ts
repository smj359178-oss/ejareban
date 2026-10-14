import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'
import { parseLocalDateKey, enumerateDays } from '@/lib/availability'
import { readJson } from '@/lib/booking-flow'

export const dynamic = 'force-dynamic'

/**
 * GET /api/listings/[slug]/availability — public blocked-days feed for the
 * booking calendar. Returns the next 6 months of blocked dates as LOCAL
 * day-key strings (YYYY-MM-DD) — plain strings are matched client-side with
 * localDateKey() so no timezone conversion can shift a day (B1).
 * A date is blocked if an Availability row marks it blocked, OR an
 * APPROVED/ACTIVE/PENDING booking covers it.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const listing = await db.listing.findUnique({
    where: { slug },
    select: { id: true, minRentalDays: true, maxRentalDays: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }

  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const to = new Date(from)
  to.setUTCDate(to.getUTCDate() + 180)

  // 1. Explicit owner-blocked / maintenance / booking dates
  const explicit = await db.availability.findMany({
    where: { listingId: listing.id, isBlocked: true },
    select: { date: true, reason: true },
  })

  // 2. Dates covered by pending/approved/active bookings
  const bookings = await db.booking.findMany({
    where: {
      listingId: listing.id,
      status: { in: ['APPROVED', 'ACTIVE', 'PENDING'] },
    },
    select: { startDate: true, endDate: true },
  })

  const blocked = new Set<string>()
  for (const e of explicit) blocked.add(e.date.toISOString().slice(0, 10))
  for (const b of bookings) {
    const start = b.startDate.toISOString().slice(0, 10)
    const end = b.endDate.toISOString().slice(0, 10)
    // enumerate over UTC-midnight keys without Date math drift
    let cur = start
    while (cur <= end) {
      blocked.add(cur)
      const d = new Date(`${cur}T00:00:00.000Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      cur = d.toISOString().slice(0, 10)
    }
  }

  return NextResponse.json({
    blockedDates: Array.from(blocked).sort(),
    minRentalDays: listing.minRentalDays,
    maxRentalDays: listing.maxRentalDays,
    rangeStart: from.toISOString().slice(0, 10),
    rangeEnd: to.toISOString().slice(0, 10),
  })
}

/**
 * POST /api/listings/[slug]/availability — owner blocks a date range (W10).
 *
 * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', reason?: 'maintenance' | 'owner_block' }
 *
 * Dates arrive as LOCAL day keys from the calendar (B1) and are stored as
 * UTC midnight rows with reason=owner_block / maintenance. Overlapping
 * booking rows are never touched — the upsert only rewrites owner-created
 * keys. Owners can also UNBLOCK previously blocked owner days via DELETE.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ error: 'برای این عملیات باید وارد شوید.' }, { status: 401 })
  }
  const { slug } = await params
  const listing = await db.listing.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, title: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }
  if (listing.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'فقط مالک آگهی می‌تواند تقویم را مدیریت کند.' },
      { status: 403 },
    )
  }

  const body = await readJson(req)
  const startKey = String(body.startDate || '')
  const endKey = String(body.endDate || startKey)
  const reason = body.reason === 'maintenance' ? 'maintenance' : 'owner_block'

  const start = parseLocalDateKey(startKey)
  const end = parseLocalDateKey(endKey)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'بازهٔ تاریخ نامعتبر است.' }, { status: 400 })
  }
  // Guard against blocking absurd ranges.
  const days = enumerateDays(start, end)
  if (days.length > 180) {
    return NextResponse.json(
      { error: 'حداکثر ۱۸۰ روز در هر بازه قابل بلاک است.' },
      { status: 400 },
    )
  }

  // Never overwrite dates held by a booking (reason='booking').
  const bookingHeld = await db.availability.findMany({
    where: {
      listingId: listing.id,
      date: { gte: start, lte: end },
      reason: 'booking',
    },
    select: { date: true },
  })
  const blockedByBooking = new Set(bookingHeld.map((r) => r.date.toISOString().slice(0, 10)))
  const freeDays = days.filter((d) => !blockedByBooking.has(d))
  if (freeDays.length === 0) {
    return NextResponse.json(
      { error: 'این تاریخ‌ها با رزروهای موجود هم‌پوشانی دارند.' },
      { status: 409 },
    )
  }

  await db.$transaction(async (tx) => {
    for (const d of freeDays) {
      const date = parseLocalDateKey(d)
      await tx.availability.upsert({
        where: { listingId_date: { listingId: listing.id, date } },
        create: { listingId: listing.id, date, isBlocked: true, reason },
        update: { isBlocked: true, reason },
      })
    }
  })

  return NextResponse.json({ ok: true, blocked: freeDays.length })
}

/**
 * DELETE /api/listings/[slug]/availability — owner unblocks days (W10).
 * Body / query: { startDate, endDate }
 * Only rows with reason owner_block|maintenance are removed — bookings stay.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ error: 'برای این عملیات باید وارد شوید.' }, { status: 401 })
  }
  const { slug } = await params
  const listing = await db.listing.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }
  if (listing.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'فقط مالک آگهی می‌تواند تقویم را مدیریت کند.' },
      { status: 403 },
    )
  }

  const body = await readJson(req)
  const startKey = String(body.startDate || '')
  const endKey = String(body.endDate || startKey)
  const start = parseLocalDateKey(startKey)
  const end = parseLocalDateKey(endKey)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'بازهٔ تاریخ نامعتبر است.' }, { status: 400 })
  }

  const result = await db.availability.deleteMany({
    where: {
      listingId: listing.id,
      date: { gte: start, lte: end },
      reason: { in: ['owner_block', 'maintenance'] },
    },
  })

  return NextResponse.json({ ok: true, unblocked: result.count })
}
