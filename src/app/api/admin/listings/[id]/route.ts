import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapListing } from '@/lib/mappers'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

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
  const moderationStatus = String(body.moderationStatus || '').toUpperCase()
  if (!['APPROVED', 'REJECTED'].includes(moderationStatus)) {
    return NextResponse.json({ error: 'وضعیت ارسالی معتبر نیست.' }, { status: 400 })
  }
  const listing = await db.listing.update({
    where: { id },
    data: {
      moderationStatus,
      rejectionReason: body.rejectionReason ?? null,
    },
    include: { category: true, owner: true },
  })
  await db.notification.create({
    data: {
      userId: listing.ownerId,
      type: 'moderation',
      title:
        moderationStatus === 'APPROVED'
          ? 'آگهی شما تأیید شد'
          : 'آگهی شما رد شد',
      body:
        moderationStatus === 'APPROVED'
          ? `آگهی «${listing.title}» تأیید و منتشر شد.`
          : `آگهی «${listing.title}» رد شد.${body.rejectionReason ? ` دلیل: ${body.rejectionReason}` : ''}`,
      link: '/dashboard?tab=listings',
    },
  })
  return NextResponse.json({ listing: mapListing(listing, { userId: user.id, isAdmin: true }) })
}
