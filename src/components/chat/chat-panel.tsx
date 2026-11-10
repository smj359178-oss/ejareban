'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  ShieldAlert,
  Send,
  ArrowRight,
  Loader2,
  CircleCheck,
  CircleDot,
  RotateCcw,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useChat, type PendingMessage } from '@/hooks/use-chat'
import { useSession } from '@/hooks/use-session'
import { formatJalaliDateShort } from '@/lib/persian'
import { toPersianDigits } from '@/lib/persian'
import type { ConversationDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: ConversationDTO | null
}

/**
 * ChatPanel — slide-in messaging Sheet for a single conversation.
 *
 * Layout (RTL): safety banner → header (other user + listing + online status)
 * → scrollable message list (sender bubbles right-aligned teal, receiver
 * bubbles left-aligned gray, optimistic pending/failed bubbles at the bottom)
 * → input row.
 *
 * Delivery is handled by the `useChat` hook via REST polling (2.5s), so the
 * panel keeps working even while offline: messages go to `pending` (spinning
 * clock) and on failure to `failed` (rose tint) where they can be retried or
 * discarded — nothing is ever silently lost.
 */
export function ChatPanel({ open, onOpenChange, conversation }: ChatPanelProps) {
  const { user } = useSession()
  const {
    messages,
    pending,
    failed,
    connected,
    sendMessage,
    retry,
    discard,
  } = useChat(
    conversation?.id ?? null,
    user?.id ?? null,
    user?.name,
    user?.avatar ?? null,
    open,
  )
  const [text, setText] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever the message count (server + pending +
  // failed) changes or the panel opens/conversation switches.
  const totalBubbles = messages.length + pending.length + failed.length
  React.useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const viewport = node.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    )
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [totalBubbles, open, conversation?.id])

  React.useEffect(() => {
    setText('')
  }, [conversation?.id])

  function handleSend() {
    const t = text.trim()
    if (!t) return
    sendMessage(t)
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
  }

  const otherUser = conversation?.otherUser
  const listing = conversation?.listing

  const renderUnsent = (item: PendingMessage, state: 'pending' | 'failed') => {
    const failed = state === 'failed'
    return (
      <div key={item.localId} className="flex w-full flex-row-reverse items-end gap-2">
        <div
          className={cn(
            'flex max-w-[78%] flex-col items-end gap-0.5',
            state === 'pending' && 'opacity-60',
          )}
        >
          <div
            className={cn(
              'whitespace-pre-line break-words rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-relaxed shadow-sm',
              failed
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-600 text-white',
            )}
          >
            {item.text}
          </div>
          {state === 'pending' ? (
            <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              در حال ارسال…
            </span>
          ) : (
            <span className="flex items-center gap-2 px-1 text-[10px]">
              <span className="text-rose-600">ارسال نشد</span>
              <button
                type="button"
                onClick={() => retry(item.localId)}
                className="flex items-center gap-0.5 text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <RotateCcw className="size-3" />
                تلاش مجدد
              </button>
              <button
                type="button"
                onClick={() => discard(item.localId)}
                className="flex items-center gap-0.5 text-muted-foreground hover:text-rose-600"
              >
                <X className="size-3" />
                حذف
              </button>
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {/* Safety banner */}
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed">
            برای امنیت خود، پرداخت و ارتباط را در پلتفرم نگه دارید. اجاره‌بان
            مسئول تراکنش‌های خارج از پلتفرم نیست.
          </p>
        </div>

        {/* Header */}
        <SheetHeader className="flex flex-row items-center gap-3 border-b p-3 pr-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onOpenChange(false)}
            aria-label="بستن"
          >
            <ArrowRight className="size-4" />
          </Button>
          <Avatar className="size-9">
            <AvatarImage src={otherUser?.avatar || undefined} alt={otherUser?.name || ''} />
            <AvatarFallback>
              {otherUser?.name?.[0] ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-sm font-semibold">
              {otherUser?.name ?? 'گفتگو'}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 truncate text-xs">
              {connected ? (
                <>
                  <CircleCheck className="size-3 text-emerald-600" />
                  آنلاین
                </>
              ) : (
                <>
                  <CircleDot className="size-3 text-muted-foreground" />
                  اتصال…
                </>
              )}
              {listing && (
                <span className="truncate">· درباره: {listing.title}</span>
              )}
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Conversation body */}
        <div ref={scrollRef} className="min-h-0 flex-1 bg-muted/30">
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-2 p-4">
              {!conversation && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  گفتگویی برای نمایش وجود ندارد.
                </div>
              )}
              {conversation && totalBubbles === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  هنوز پیامی رد و بدل نشده — اولین پیام را ارسال کنید.
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user?.id
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex w-full items-end gap-2',
                      mine ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    {!mine && (
                      <Avatar className="size-7">
                        <AvatarImage
                          src={m.senderAvatar || undefined}
                          alt={m.senderName}
                        />
                        <AvatarFallback className="text-xs">
                          {m.senderName?.[0] ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'flex max-w-[78%] flex-col gap-0.5',
                        mine ? 'items-end' : 'items-start',
                      )}
                    >
                      <div
                        className={cn(
                          'whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                          mine
                            ? 'rounded-bl-md bg-emerald-600 text-white'
                            : 'rounded-br-md bg-card text-card-foreground border',
                        )}
                      >
                        {m.text}
                      </div>
                      <span className="px-1 text-[10px] text-muted-foreground">
                        {formatJalaliDateShort(m.createdAt)} ·{' '}
                        {toPersianDigits(
                          new Date(m.createdAt).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
              {pending.map((p) => renderUnsent(p, 'pending'))}
              {failed.map((f) => renderUnsent(f, 'failed'))}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="border-t bg-background p-3">
          <div className="flex items-center gap-2">
            <Input
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="پیام بنویسید…"
              className="h-10 flex-1"
              disabled={!conversation}
              aria-label="متن پیام"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!text.trim() || !conversation}
              aria-label="ارسال"
              className="size-10 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
          {!connected && conversation && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              اتصال برقرار نیست؛ پیام‌های ارسالی در صف می‌مانند و پس از بازگشت
              اتصال می‌توانید دوباره تلاش کنید.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Tiny helper to keep the JSX above readable — listing thumbnail for the
// conversations list sheet (used by the navbar).
export function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationDTO
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-2 text-right transition-colors hover:bg-muted',
        active && 'bg-muted',
      )}
    >
      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
        {conversation.listing?.images?.[0] && (
          <Image
            src={conversation.listing.images[0]}
            alt={conversation.listing.title}
            fill
            sizes="44px"
            className="object-cover"
          />
        )}
      </div>
      <Avatar className="size-9 shrink-0">
        <AvatarImage src={conversation.otherUser.avatar || undefined} alt={conversation.otherUser.name} />
        <AvatarFallback>{conversation.otherUser.name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {conversation.otherUser.name}
          </span>
          {conversation.unreadCount > 0 && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              {toPersianDigits(conversation.unreadCount)}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage ?? 'بدون پیام'}
        </p>
        {conversation.listing && (
          <p className="truncate text-[11px] text-muted-foreground/80">
            {conversation.listing.title}
          </p>
        )}
      </div>
    </button>
  )
}
