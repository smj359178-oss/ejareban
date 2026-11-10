'use client'

import * as React from 'react'
import type { ChatMessageDTO } from '@/lib/types'

/**
 * useChat — REST-polling chat hook for a single conversation.
 *
 * Replaces the previous socket.io implementation (the standalone chat
 * mini-service no longer exists) with a reliable strategy that never loses
 * messages:
 *
 *   - While a conversation is open, the hook polls
 *     GET /api/chat/:conversationId every 2500ms (paused while the tab is
 *     hidden) and merges the full server list into the local cache, deduped
 *     by id. An immediate fetch also happens on mount / conversation change.
 *   - The GET endpoint marks inbound messages as read, so polling naturally
 *     keeps the unread badge fresh.
 *   - `sendMessage` is optimistic: the text goes into `pending` with a
 *     localId and is POSTed to /api/chat/:conversationId. On success the
 *     server-confirmed message is merged into `messages`; on failure the
 *     item moves to `failed` where the user can `retry` or `discard` it
 *     (U3 — messages must never be silently dropped).
 *   - `connected` reflects the last poll/send outcome (true = last request
 *     succeeded → "آنلاین", false = failing → "اتصال…").
 *   - Unsent items are stored per conversation, so switching conversations
 *     never drops pending/failed messages.
 *
 * The typing indicator was part of the socket service; `typing` is kept as a
 * constant `false` for API compatibility with existing consumers.
 */

export type { ChatMessageDTO }

/** An optimistic (not-yet-server-confirmed) chat message held client-side. */
export interface PendingMessage {
  localId: string
  text: string
  createdAt: string
}

const POLL_INTERVAL_MS = 2500

interface Outbox {
  pending: PendingMessage[]
  failed: PendingMessage[]
}

function sortAsc(list: ChatMessageDTO[]): ChatMessageDTO[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

/** Merge server messages into the cache, deduping by id (server wins). */
function mergeMessages(
  prev: ChatMessageDTO[],
  incoming: ChatMessageDTO[],
): ChatMessageDTO[] {
  if (incoming.length === 0 && prev.length === 0) return prev
  const byId = new Map<string, ChatMessageDTO>()
  for (const m of prev) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return sortAsc([...byId.values()])
}

export function useChat(
  conversationId: string | null,
  userId: string | null,
  senderName?: string | null,
  senderAvatar?: string | null,
  active = true,
) {
  const [messages, setMessages] = React.useState<ChatMessageDTO[]>([])
  const [pending, setPending] = React.useState<PendingMessage[]>([])
  const [failed, setFailed] = React.useState<PendingMessage[]>([])
  const [connected, setConnected] = React.useState(false)
  // Typing indicator removed with the socket service — constant for API compat.
  const typing = false

  const conversationIdRef = React.useRef<string | null>(conversationId)
  React.useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  const userIdRef = React.useRef<string | null>(userId)
  React.useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const senderNameRef = React.useRef<string | null | undefined>(senderName)
  React.useEffect(() => {
    senderNameRef.current = senderName
  }, [senderName])

  const senderAvatarRef = React.useRef<string | null | undefined>(senderAvatar)
  React.useEffect(() => {
    senderAvatarRef.current = senderAvatar
  }, [senderAvatar])

  // B6 — polling must only run while the panel is actually open: the GET
  // endpoint marks inbound messages as read, so polling while closed would
  // silently clear unread badges for messages the user never saw.
  const activeRef = React.useRef(active)
  React.useEffect(() => {
    activeRef.current = active
  }, [active])

  // Unsent messages (pending + failed) are stored per conversation so that
  // switching conversations never drops them; only the active conversation's
  // items are mirrored into state for rendering.
  const outboxRef = React.useRef<Map<string, Outbox>>(new Map())
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const updateOutbox = React.useCallback(
    (convId: string, mutate: (prev: Outbox) => Outbox) => {
      const next = mutate(
        outboxRef.current.get(convId) ?? { pending: [], failed: [] },
      )
      outboxRef.current.set(convId, next)
      if (conversationIdRef.current === convId) {
        setPending(next.pending)
        setFailed(next.failed)
      }
    },
    [],
  )

  // -------- Polling: full-list GET, dedupe by id, merge --------
  const fetchMessages = React.useCallback(async (convId: string) => {
    try {
      const r = await fetch(`/api/chat/${convId}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`chat poll failed: ${r.status}`)
      const d = (await r.json()) as { messages?: ChatMessageDTO[] }
      setMessages((prev) => mergeMessages(prev, d.messages ?? []))
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  // Reset the local cache when the hook mounts or the conversation changes,
  // restore this conversation's unsent items, and fetch immediately.
  React.useEffect(() => {
    setMessages([])
    setConnected(false)
    if (!conversationId) {
      setPending([])
      setFailed([])
      return
    }
    const box = outboxRef.current.get(conversationId)
    setPending(box?.pending ?? [])
    setFailed(box?.failed ?? [])
    // Fetch immediately only while the panel is open; a closed panel must
    // not mark the conversation as read (B6).
    if (activeRef.current) void fetchMessages(conversationId)
  }, [conversationId, fetchMessages])

  // One interval per open conversation; runs only while the panel is open
  // (B6) and pauses while the tab is hidden.
  React.useEffect(() => {
    if (!conversationId || !active) return
    // Catch up immediately when the panel opens.
    void fetchMessages(conversationId)
    intervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void fetchMessages(conversationId)
    }, POLL_INTERVAL_MS)
    // Catch up immediately when the tab becomes visible again.
    const onVisibility = () => {
      if (!document.hidden) void fetchMessages(conversationId)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [conversationId, active, fetchMessages])

  // -------- POST one pending item; on failure park it in `failed` --------
  const postPending = React.useCallback(
    async (convId: string, item: PendingMessage) => {
      try {
        const r = await fetch(`/api/chat/${convId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: item.text,
            senderName: senderNameRef.current ?? undefined,
            senderAvatar: senderAvatarRef.current ?? undefined,
          }),
        })
        if (!r.ok) throw new Error(`chat send failed: ${r.status}`)
        const d = (await r.json()) as { message: ChatMessageDTO }
        // Confirmed: remove from pending, merge (dedupe by id) into messages.
        updateOutbox(convId, (prev) => ({
          ...prev,
          pending: prev.pending.filter((p) => p.localId !== item.localId),
        }))
        // Merge only if the user is still viewing this conversation (the
        // message stays server-side otherwise and is picked up by polling).
        setMessages((prev) =>
          conversationIdRef.current === convId &&
          !prev.some((m) => m.id === d.message.id)
            ? mergeMessages(prev, [d.message])
            : prev,
        )
        if (conversationIdRef.current === convId) setConnected(true)
      } catch {
        // Network error or !res.ok → move to failed, never lose the text.
        updateOutbox(convId, (prev) => ({
          pending: prev.pending.filter((p) => p.localId !== item.localId),
          failed: prev.failed.some((f) => f.localId === item.localId)
            ? prev.failed
            : [...prev.failed, item],
        }))
        if (conversationIdRef.current === convId) setConnected(false)
      }
    },
    [updateOutbox],
  )

  // -------- Actions --------
  const sendMessage = React.useCallback(
    (text: string) => {
      const convId = conversationIdRef.current
      const trimmed = text.trim()
      if (!convId || !trimmed || !userIdRef.current) return
      const item: PendingMessage = {
        localId: crypto.randomUUID(),
        text: trimmed,
        createdAt: new Date().toISOString(),
      }
      updateOutbox(convId, (prev) => ({
        ...prev,
        pending: [...prev.pending, item],
      }))
      void postPending(convId, item)
    },
    [updateOutbox, postPending],
  )

  const retry = React.useCallback(
    (localId: string) => {
      const convId = conversationIdRef.current
      if (!convId) return
      const item = outboxRef.current.get(convId)?.failed.find(
        (f) => f.localId === localId,
      )
      if (!item) return
      updateOutbox(convId, (prev) => ({
        pending: [...prev.pending, item],
        failed: prev.failed.filter((f) => f.localId !== localId),
      }))
      void postPending(convId, item)
    },
    [updateOutbox, postPending],
  )

  const discard = React.useCallback(
    (localId: string) => {
      const convId = conversationIdRef.current
      if (!convId) return
      updateOutbox(convId, (prev) => ({
        ...prev,
        failed: prev.failed.filter((f) => f.localId !== localId),
      }))
    },
    [updateOutbox],
  )

  return {
    messages,
    pending,
    failed,
    typing,
    connected,
    sendMessage,
    retry,
    discard,
  }
}
