import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'دسترسی فقط برای مدیر مجاز است.' },
      { status: 403 },
    )
  }
  const reqs = await db.verificationRequest.findMany({
    where: { status: 'PENDING' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    requests: reqs.map((r) => ({
      id: r.id,
      nationalId: r.nationalId,
      phone: r.phone,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user.id,
        name: r.user.name,
        avatar: r.user.avatar,
        email: r.user.email,
        city: r.user.city,
      },
    })),
  })
}
