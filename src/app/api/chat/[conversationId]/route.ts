import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ conversationId: string }>
}

/**
 * GET /api/chat/[conversationId]
 * Returns all messages in a conversation. Authorization: the caller must be
 * a participant of the conversation. As a side-effect, this also marks every
 * inbound (i.e. sent-by-other) unread message as read so the navbar badge
 * count updates correctly when the user opens the panel.
 */
export async function GET(req: Request, ctx: RouteContext) {
  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای استفاده از گفتگو باید وارد شوید.' },
      { status: 401 },
    )
  }
  const { conversationId } = await ctx.params

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { participantA: true, participantB: true },
  })
  if (!conv) {
    return NextResponse.json(
      { error: 'گفتگو یافت نشد.' },
      { status: 404 },
    )
  }
  if (user.id !== conv.participantA && user.id !== conv.participantB) {
    return NextResponse.json(
      { error: 'شما به این گفتگو دسترسی ندارید.' },
      { status: 403 },
    )
  }

  const messages = await db.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: { id: true, name: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Mark inbound unread messages as read now that the user has opened the panel.
  await db.message.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      read: false,
    },
    data: { read: true },
  })

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatar: m.sender.avatar ?? null,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}

/**
 * POST /api/chat/[conversationId]
 * REST fallback for sending a message — used when the socket connection is
 * unavailable (e.g. client-side transport fallback). The socket mini-service
 * remains the primary path; this route just guarantees a write path exists.
 *
 * NOTE: This route does not broadcast over socket.io — the chat panel always
 * tries the socket first; the REST fallback is for resilience.
 */
const SendSchema = z.object({
  text: z.string().min(1).max(4000),
  senderName: z.string().optional(),
  senderAvatar: z.string().nullable().optional(),
})

export async function POST(req: Request, ctx: RouteContext) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json(
      { error: 'برای ارسال پیام باید وارد شوید.' },
      { status: 401 },
    )
  }
  const { conversationId } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { text, senderName, senderAvatar } = parsed.data

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { participantA: true, participantB: true },
  })
  if (!conv) {
    return NextResponse.json(
      { error: 'گفتگو یافت نشد.' },
      { status: 404 },
    )
  }
  if (user.id !== conv.participantA && user.id !== conv.participantB) {
    return NextResponse.json(
      { error: 'شما به این گفتگو دسترسی ندارید.' },
      { status: 403 },
    )
  }

  const message = await db.message.create({
    data: {
      conversationId,
      senderId: user.id,
      text,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  })

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessage: text, lastMessageAt: message.createdAt },
  })

  return NextResponse.json({
    message: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: senderName ?? message.sender.name,
      senderAvatar: senderAvatar ?? message.sender.avatar ?? null,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    },
  }, { status: 201 })
}
