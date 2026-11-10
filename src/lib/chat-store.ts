'use client'

import { create } from 'zustand'
import type { ConversationDTO } from './types'

/**
 * Chat store — coordinates the chat panel UI across views.
 *
 * The panel itself is hosted once (in <ChatPanelHost /> mounted in page.tsx).
 * Any view (listing-view, navbar, dashboard) can call `openConversation` or
 * `openInbox` to drive the UI without prop-drilling.
 */
interface ChatState {
  // Single-conversation panel
  panelOpen: boolean
  currentConversation: ConversationDTO | null
  openConversation: (c: ConversationDTO) => void
  closePanel: () => void

  // Inbox (conversations list) sheet
  inboxOpen: boolean
  openInbox: () => void
  closeInbox: () => void

  // Optional: signal that a fresh notification arrived (used by the navbar
  // badge to refresh the conversations list immediately).
  notificationNonce: number
  bumpNotification: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  panelOpen: false,
  currentConversation: null,
  openConversation: (c) =>
    set({ panelOpen: true, currentConversation: c, inboxOpen: false }),
  closePanel: () => set({ panelOpen: false }),

  inboxOpen: false,
  openInbox: () => set({ inboxOpen: true }),
  closeInbox: () => set({ inboxOpen: false }),

  notificationNonce: 0,
  bumpNotification: () =>
    set((s) => ({ notificationNonce: s.notificationNonce + 1 })),
}))
