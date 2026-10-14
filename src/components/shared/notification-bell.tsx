'use client'

import * as React from 'react'
import {
  Bell,
  BellRing,
  CalendarCheck,
  FileCheck,
  HandCoins,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Star,
  PackageCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNav } from '@/lib/store'
import { useSession } from '@/hooks/use-session'
import { toPersianDigits } from '@/lib/persian'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  booking_request: CalendarCheck,
  booking_request_admin: ShieldCheck,
  booking_admin_reviewed: ShieldCheck,
  booking_approved: CalendarCheck,
  booking_update: CalendarCheck,
  booking_delivered: PackageCheck,
  booking_paid: HandCoins,
  booking_returned: PackageCheck,
  contract_signed: FileCheck,
  contract_pending_signature: FileCheck,
  deposit_refunded: HandCoins,
  payout_settled: HandCoins,
  review_received: Star,
  message: MessageSquare,
  moderation: ShieldCheck,
  system: Bell,
}

/**
 * NotificationBell (B8/W2) — the navbar bell that finally surfaces the
 * notifications which were silently piling up in the DB with no UI.
 *
 * - polls /api/notifications every 30s + on window focus
 * - unread badge on the bell
 * - click an item → mark it read + navigate to its link (SPA hash nav)
 * - «علامت‌گذاری همه» marks everything read
 */
export function NotificationBell() {
  const { user } = useSession()
  const notify = useNav((s) => s.notify)
  const go = useNav((s) => s.go)
  const [items, setItems] = React.useState<NotificationItem[]>([])
  const [unread, setUnread] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      if (!r.ok) return
      const d = (await r.json()) as {
        notifications: NotificationItem[]
        unread: number
      }
      setItems(d.notifications ?? [])
      setUnread(d.unread ?? 0)
    } catch {
      /* transient */
    }
  }, [])

  React.useEffect(() => {
    if (!user) {
      setItems([])
      setUnread(0)
      return
    }
    setLoading(true)
    refresh().finally(() => setLoading(false))
    const id = setInterval(refresh, 30_000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [user, refresh])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    refresh()
  }

  async function openItem(n: NotificationItem) {
    setOpen(false)
    if (!n.read) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      }).then(refresh)
    }
    if (n.link) {
      // Links are SPA paths like /dashboard?tab=bookings — translate to hash.
      const m = n.link.match(/^\/([a-z-]+)\?tab=([a-z-]+)$/i)
      if (m) {
        go({ name: m[1] as 'dashboard' | 'admin', tab: m[2] as never })
      } else {
        go({ name: 'dashboard', tab: 'bookings' })
      }
    } else {
      go({ name: 'dashboard', tab: 'bookings' })
    }
  }

  if (!user) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={unread > 0 ? `اعلان‌ها (${toPersianDigits(unread)} خوانده‌نشده)` : 'اعلان‌ها'}
        >
          {unread > 0 ? (
            <BellRing className="size-5 text-primary" />
          ) : (
            <Bell className="size-5" />
          )}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {toPersianDigits(unread > 9 ? '۹+' : unread)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-primary" /> اعلان‌ها
            {unread > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {toPersianDigits(unread)} جدید
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-primary hover:underline"
            >
              علامت‌گذاری همه
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Inbox className="size-7 text-muted-foreground/50" />
                  اعلانی ندارید — خبرهای رزروها و پیام‌ها اینجا نمایش داده می‌شود.
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={cn(
                      'flex items-start gap-3 border-b px-4 py-3 text-right transition-colors last:border-b-0 hover:bg-muted/60',
                      !n.read && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                        !n.read
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
