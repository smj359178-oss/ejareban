'use client'

import * as React from 'react'
import { MessageSquare, Inbox, Loader2, ArrowRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatPanel, ConversationListItem } from '@/components/chat/chat-panel'
import { useChatStore } from '@/lib/chat-store'
import { useSession } from '@/hooks/use-session'
import { useFetch } from '@/hooks/use-fetch'
import type { ConversationDTO } from '@/lib/types'

/**
 * ChatPanelHost — single mount-point (in page.tsx) that drives both the
 * conversations inbox Sheet and the active conversation ChatPanel based on
 * the global chat store.
 *
 * Components elsewhere (listing-view, navbar) call store actions
 * (`openInbox`, `openConversation`) instead of holding their own UI state.
 */
export function ChatPanelHost() {
  const {
    panelOpen,
    currentConversation,
    closePanel,
    inboxOpen,
    openInbox,
    closeInbox,
    openConversation,
    notificationNonce,
  } = useChatStore()
  const { user } = useSession()

  // Re-fetch conversations whenever the inbox opens or a new notification
  // arrives. `useFetch` re-runs whenever `url` or any entry of the deps
  // array changes, so passing [notificationNonce, inboxOpen] is sufficient.
  // IMPORTANT: do NOT put `reload` in an effect dependency — it is a fresh
  // function identity on every render, which caused an infinite
  // setState loop (Maximum update depth exceeded) when the inbox opened.
  const { data, loading } = useFetch<{ conversations: ConversationDTO[] }>(
    inboxOpen ? '/api/chat/conversations' : null,
    [notificationNonce, inboxOpen],
  )

  const conversations = data?.conversations ?? []

  return (
    <>
      {/* Inbox (conversations list) sheet */}
      <Sheet open={inboxOpen} onOpenChange={(o) => (o ? openInbox() : closeInbox())}>
        <SheetContent
          side="left"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="flex flex-row items-center gap-3 border-b p-3 pr-4">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={closeInbox}
              aria-label="بستن"
            >
              <ArrowRight className="size-4" />
            </Button>
            <SheetTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4" /> پیام‌ها
            </SheetTitle>
            <SheetDescription className="sr-only">
              فهرست گفتگوهای شما
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 bg-muted/20">
            <ScrollArea className="h-full w-full">
              {loading && conversations.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> در حال بارگذاری…
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <MessageSquare className="size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    هنوز گفتگویی ندارید.
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    با کلیک روی «پیام» در صفحهٔ آگهی، گفتگوی جدیدی آغاز کنید.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 p-2">
                  {conversations.map((c) => (
                    <ConversationListItem
                      key={c.id}
                      conversation={c}
                      active={c.id === currentConversation?.id}
                      onClick={() => openConversation(c)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active conversation chat panel — only rendered when there's a
          conversation to render. Mounts the useChat hook inside ChatPanel. */}
      {currentConversation && user && (
        <ChatPanel
          open={panelOpen}
          onOpenChange={(o) => {
            if (!o) closePanel()
          }}
          conversation={currentConversation}
        />
      )}
    </>
  )
}
