import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapListing } from '@/lib/mappers'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ favorites: [] })
  }
  const { searchParams } = new URL(req.url)
  const detail = searchParams.get('detail') === '1'

  const favs = await db.favorite.findMany({
    where: { userId: user.id },
    include: { listing: { include: { category: true, owner: true } } },
  })
  const ids = favs.map((f) => f.listingId)
  if (!detail) {
    return NextResponse.json({ favorites: ids })
  }
  // ?detail=1 — also return the listing objects so the dashboard can render
  // favorite cards without a separate /api/listings round-trip per item.
  // Privacy: viewer-aware masking (guests never reach this — user is set,
  // but an owner only sees full address on their own listings).
  const viewer = { userId: user.id, isAdmin: user.role === 'ADMIN' }
  return NextResponse.json({
    favorites: ids,
    listings: favs.map((f) => mapListing(f.listing, viewer)),
  })
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای ذخیرهٔ آگهی باید وارد شوید.' },
      { status: 401 },
    )
  }
  const { listingId } = await req.json().catch(() => ({}))
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی الزامی است.' }, { status: 400 })
  }
  // The favorite FK would reject an unknown listing with a raw 500 (B12);
  // validate first so the client gets a clean 404.
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }
  await db.favorite.upsert({
    where: { userId_listingId: { userId: user.id, listingId } },
    create: { userId: user.id, listingId },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
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
  const { searchParams } = new URL(req.url)
  const listingId = searchParams.get('listingId')
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی الزامی است.' }, { status: 400 })
  }
  await db.favorite.deleteMany({
    where: { userId: user.id, listingId },
  })
  return NextResponse.json({ ok: true })
}
