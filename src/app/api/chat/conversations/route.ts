import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/conversations
 * Returns the current user's conversations, with the OTHER participant's info,
 * a small slice of the listing, the last message, and an unread count.
 */
export async function GET(req: Request) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ conversations: [] })
  }

  const conversations = await db.conversation.findMany({
    where: {
      OR: [{ participantA: user.id }, { participantB: user.id }],
    },
    include: {
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          images: true,
          ownerId: true,
        },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  })

  // Resolve the OTHER participant + unread count for each conversation.
  const otherUserIds = conversations.map((c) =>
    c.participantA === user.id ? c.participantB : c.participantA,
  )
  const otherUsers = await db.user.findMany({
    where: { id: { in: otherUserIds } },
    select: { id: true, name: true, avatar: true },
  })
  const userMap = new Map(otherUsers.map((u) => [u.id, u]))

  const unreadCounts = await db.message.groupBy({
    by: ['conversationId'],
    where: {
      senderId: { not: user.id },
      read: false,
      conversation: {
        OR: [{ participantA: user.id }, { participantB: user.id }],
      },
    },
    _count: { _all: true },
  })
  const unreadMap = new Map(
    unreadCounts.map((u) => [u.conversationId, u._count._all]),
  )

  const out = conversations.map((c) => {
    const otherId = c.participantA === user.id ? c.participantB : c.participantA
    const other = userMap.get(otherId)
    return {
      id: c.id,
      listingId: c.listingId,
      listing: c.listing
        ? {
            id: c.listing.id,
            slug: c.listing.slug,
            title: c.listing.title,
            // images is JSON-encoded String in SQLite; surface as array.
            images: safeParseImages(c.listing.images),
          }
        : null,
      otherUser: {
        id: other?.id ?? otherId,
        name: other?.name ?? 'کاربر',
        avatar: other?.avatar ?? null,
      },
      lastMessage: c.lastMessage ?? null,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      unreadCount: unreadMap.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    }
  })

  return NextResponse.json({ conversations: out })
}

function safeParseImages(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * POST /api/chat/conversations
 * Create-or-find a 1-to-1 conversation between the current user and another
 * user about a specific listing. The pair (listingId, participantA,
 * participantB) is unique — the order of A/B is normalized so that whichever
 * user id sorts first becomes `participantA`. This guarantees the same
 * conversation row is reused regardless of which side initiates.
 */
const CreateSchema = z.object({
  listingId: z.string(),
  otherUserId: z.string(),
})

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای شروع گفتگو باید وارد شوید.' },
      { status: 401 },
    )
  }
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { listingId, otherUserId } = parsed.data
  if (otherUserId === user.id) {
    return NextResponse.json(
      { error: 'نمی‌توانید با خودتان گفتگو شروع کنید.' },
      { status: 400 },
    )
  }

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true },
  })
  if (!listing) {
    return NextResponse.json({ error: 'آگهی مورد نظر یافت نشد.' }, { status: 404 })
  }
  if (listing.ownerId !== otherUserId && listing.ownerId !== user.id) {
    return NextResponse.json(
      { error: 'گفتگو باید با مالک آگهی باشد.' },
      { status: 400 },
    )
  }

  // Normalize participant ordering so the unique constraint stays consistent
  // regardless of who initiated the chat.
  const [a, b] =
    user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id]

  const conversation = await db.conversation.upsert({
    where: {
      listingId_participantA_participantB: {
        listingId,
        participantA: a,
        participantB: b,
      },
    },
    create: {
      listingId,
      participantA: a,
      participantB: b,
    },
    update: {},
    include: {
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          images: true,
        },
      },
    },
  })

  const otherId = conversation.participantA === user.id
    ? conversation.participantB
    : conversation.participantA
  const other = await db.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, avatar: true },
  })

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      listingId: conversation.listingId,
      listing: conversation.listing
        ? {
            id: conversation.listing.id,
            slug: conversation.listing.slug,
            title: conversation.listing.title,
            images: safeParseImages(conversation.listing.images),
          }
        : null,
      otherUser: {
        id: other?.id ?? otherId,
        name: other?.name ?? 'کاربر',
        avatar: other?.avatar ?? null,
      },
      lastMessage: conversation.lastMessage ?? null,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount: 0,
      createdAt: conversation.createdAt.toISOString(),
    },
  })
}
