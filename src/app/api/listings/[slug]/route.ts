import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapListing } from '@/lib/mappers'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Resolve the viewer FIRST so privacy (bug 12) and the view counter
  // (bug 9) can be applied together.
  const { user } = await getSession(req)
  const viewer = user ? { userId: user.id, isAdmin: user.role === 'ADMIN' } : null

  const { slug } = await params
  const listing = await db.listing.findUnique({
    where: { slug },
    include: { category: true, owner: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }

  // Fire-and-forget view counter (server-side, tamper-proof) — but never
  // count the owner's own visits (bug 9).
  if (!user || user.id !== listing.ownerId) {
    await db.listing.update({
      where: { id: listing.id },
      data: { views: { increment: 1 } },
    })
  }

  // Viewer-aware privacy: anonymous → masked owner + no address/lat/lng;
  // logged-in non-owner → no exact address; owner/admin → full detail.
  return NextResponse.json({ listing: mapListing(listing, viewer) })
}
