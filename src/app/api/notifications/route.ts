import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications — the data behind the navbar bell (B8/W2).
 *
 * Notifications have been written to the DB since day one, but there was no
 * way to read them from the UI. Returns the latest 30 notifications plus the
 * unread count so the badge can render.
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ notifications: [], unread: 0 })
  }

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link ?? null,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  })
}

/**
 * PATCH /api/notifications — mark notifications as read.
 * Body: { id?: string } — when `id` is given only that row is marked;
 * otherwise every unread notification of the user is marked read
 * («علامت‌گذاری همه به‌عنوان خوانده‌شده»).
 */
export async function PATCH(req: Request) {
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
  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' && body.id ? body.id : null

  const result = await db.notification.updateMany({
    where: id ? { id, userId: user.id } : { userId: user.id, read: false },
    data: { read: true },
  })

  return NextResponse.json({ ok: true, updated: result.count })
}
