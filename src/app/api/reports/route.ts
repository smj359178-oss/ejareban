import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

const ReportSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum(['spam', 'scam', 'inappropriate', 'duplicate', 'other']),
  description: z.string().max(2000).optional(),
})

/**
 * POST /api/reports — report a listing (bug 7).
 *
 * The listing-view form previously only fired an OPTIONS preflight and no
 * report was ever persisted. This is the real endpoint behind it.
 *
 * Body: { listingId, reason: 'spam'|'scam'|'inappropriate'|'duplicate'|'other', description? }
 *
 * - Auth required.
 * - Same-origin only (CSRF).
 * - Rate limited: 5 reports per 10 minutes per user.
 * - Creates a Report row with status OPEN for the admin console.
 */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای گزارش تخلف باید وارد شوید.' },
      { status: 401 },
    )
  }

  // Anti-abuse: 5 reports per 10 minutes per user
  const rl = checkRateLimit(req, { limit: 5, windowMs: 10 * 60 * 1000 }, `report:${user.id}`)
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = ReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { listingId, reason, description } = parsed.data

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }

  await db.report.create({
    data: {
      reporterId: user.id,
      listingId,
      reason,
      description: description ?? null,
      status: 'OPEN',
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
