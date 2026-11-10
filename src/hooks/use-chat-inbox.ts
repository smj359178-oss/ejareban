'use client'

import * as React from 'react'
import { useChatStore } from '@/lib/chat-store'

/**
 * useChatInbox — keeps the navbar unread badge in sync (pure polling).
 *
 * Polls GET /api/chat/conversations every 25s and on window focus, summing
 * unreadCount across conversations. (The previous socket.io notification
 * listener was removed together with the chat mini-service; opening a
 * conversation marks its messages read server-side, so the count converges
 * naturally on each poll / focus refresh.)
 *
 * Returns the unread count + a manual `refresh` so the navbar can force an
 * update when needed.
 */
export function useChatInbox(userId: string | null | undefined) {
  const [unread, setUnread] = React.useState(0)

  // -------- Poll conversations list (initial + every 25s + on focus) --------
  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/chat/conversations', { cache: 'no-store' })
      if (!r.ok) return
      const d = (await r.json()) as {
        conversations?: { unreadCount?: number }[]
      }
      const total = (d.conversations ?? []).reduce(
        (sum, c) => sum + (c.unreadCount ?? 0),
        0,
      )
      setUnread(total)
    } catch {
      /* ignore transient errors */
    }
  }, [])

  React.useEffect(() => {
    if (!userId) {
      setUnread(0)
      return
    }
    refresh()
    const id = setInterval(refresh, 25_000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

  return { unread, refresh }
}

// Re-export the chat store for the navbar / panel host to subscribe to the
// inbox open state without pulling in `@/lib/chat-store` separately.
export { useChatStore }
