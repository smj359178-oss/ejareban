import { db } from '@/lib/db'
import { getSession, type SessionUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Shared helpers for the booking lifecycle endpoints (steps 2-12).
 */

/** Booking row with all relations (non-null — validated in resolveBookingActor). */
export type BookingWithRelations = NonNullable<
  Awaited<ReturnType<typeof loadBooking>>
>

export interface BookingActorContext {
  booking: BookingWithRelations
  user: SessionUser
  isOwner: boolean
  isRenter: boolean
  isAdmin: boolean
}

/** Load a booking with all relations or `null`. */
export function loadBooking(id: string) {
  return db.booking.findUnique({
    where: { id },
    include: { listing: true, renter: true, owner: true },
  })
}

/**
 * Resolve the acting user and their relationship to the booking.
 * Returns either a context object or a ready-made error Response.
 */
export async function resolveBookingActor(
  req: Request,
  id: string,
): Promise<BookingActorContext | { error: Response }> {
  const { user } = await getSession(req)
  if (!user) {
    return {
      error: json({ error: 'برای این عملیات باید وارد شوید.' }, 401),
    }
  }
  const booking = await loadBooking(id)
  if (!booking) {
    return { error: json({ error: 'رزرو مورد نظر یافت نشد.' }, 404) }
  }
  const isOwner = booking.ownerId === user.id
  const isRenter = booking.renterId === user.id
  const isAdmin = user.role === 'ADMIN'
  if (!isOwner && !isRenter && !isAdmin) {
    return {
      error: json({ error: 'شما اجازهٔ انجام این عملیات را ندارید.' }, 403),
    }
  }
  return { booking, user, isOwner, isRenter, isAdmin }
}

/** Create an in-app notification (fire-and-forget safe with await). */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  link: string = '/dashboard?tab=bookings',
) {
  await db.notification.create({
    data: { userId, type, title, body, link },
  })
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status })
}

/** Parse a JSON body safely, returning `{}` on failure. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>
}
