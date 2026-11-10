import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'
import { parseImages } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'OPEN'
  const reports = await db.report.findMany({
    where: status === 'all' ? {} : { status },
    include: { reporter: true, listing: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporter: { id: r.reporter.id, name: r.reporter.name, avatar: r.reporter.avatar },
      listing: r.listing
        ? {
            id: r.listing.id,
            title: r.listing.title,
            slug: r.listing.slug,
            // parseImages never throws on malformed JSON (B11), unlike the
            // raw JSON.parse that 500'd the whole admin reports page.
            images: parseImages(r.listing.images),
          }
        : null,
    })),
  })
}

export async function PATCH(req: Request) {
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
  const { id, status } = await req.json().catch(() => ({}))
  if (!['RESOLVED', 'DISMISSED'].includes(status)) {
    return NextResponse.json({ error: 'وضعیت ارسالی معتبر نیست.' }, { status: 400 })
  }
  const report = await db.report.update({
    where: { id },
    data: { status },
  })
  return NextResponse.json({ report })
}
