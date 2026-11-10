import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
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
  const status = body.status === 'APPROVED' ? 'APPROVED' : 'REJECTED'
  const verification = await db.verificationRequest.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!verification) {
    return NextResponse.json({ error: 'درخواست مورد نظر یافت نشد.' }, { status: 404 })
  }
  // Re-approving an already-approved request must not re-apply the trust
  // bonus (B13).
  if (verification.status === 'APPROVED' && status === 'APPROVED') {
    return NextResponse.json(
      { error: 'این درخواست قبلاً تأیید شده است.' },
      { status: 400 },
    )
  }
  await db.verificationRequest.update({
    where: { id },
    data: { status, reviewerNote: body.note ?? null },
  })
  if (status === 'APPROVED') {
    await db.user.update({
      where: { id: verification.userId },
      data: {
        isIdentityVerified: true,
        // Clamp at 100 so repeated bonuses cannot inflate the score (B13).
        trustScore: Math.min(100, verification.user.trustScore + 15),
      },
    })
    await db.notification.create({
      data: {
        userId: verification.userId,
        type: 'verification',
        title: 'هویت شما تأیید شد',
        body: 'هویت شما تأیید شد و نشان اعتماد به پروفایل شما اضافه شد.',
      },
    })
  } else {
    await db.notification.create({
      data: {
        userId: verification.userId,
        type: 'verification',
        title: 'درخواست احراز هویت رد شد',
        body: `درخواست احراز هویت شما رد شد. ${body.note ?? 'لطفاً با مدارک معتبر دوباره تلاش کنید.'}`,
      },
    })
  }
  return NextResponse.json({ ok: true })
}
