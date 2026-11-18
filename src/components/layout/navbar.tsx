'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Moon,
  Sun,
  Menu,
  LayoutDashboard,
  Shield,
  Plus,
  UserRound,
  UserPlus,
  LogIn,
  LogOut,
  MessageSquare,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useNav } from '@/lib/store'
import { useChatStore } from '@/lib/chat-store'
import { useSession } from '@/hooks/use-session'
import { useChatInbox } from '@/hooks/use-chat-inbox'
import { NotificationBell } from '@/components/shared/notification-bell'
import { BrandMark } from '@/components/shared/brand-mark'
import { toPersianDigits } from '@/lib/persian'

const NAV_CATEGORIES = [
  { slug: 'electronics', label: 'الکترونیک' },
  { slug: 'cameras', label: 'دوربین' },
  { slug: 'tools', label: 'ابزار' },
  { slug: 'events', label: 'مراسم' },
  { slug: 'sports', label: 'ورزش' },
  { slug: 'vehicles', label: 'وسایل نقلیه' },
]

const emptySubscribe = () => () => {}

export function Navbar() {
  const { go, view, notify } = useNav()
  const { theme, setTheme } = useTheme()
  const { user, loading, logout } = useSession()
  const router = useRouter()
  const openInbox = useChatStore((s) => s.openInbox)
  const { unread } = useChatInbox(user?.id)
  const [q, setQ] = React.useState('')
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    go({ name: 'browse', query: q })
  }

  // بخش‌هایی که حساب کاربری لازم دارند: مهمان‌ها به‌جای خطای ۴۰۱، پیام
  // فارسی می‌بینند و به صفحه ورود هدایت می‌شوند. (bugs 14)
  function requireLogin(message: string, action: () => void) {
    if (user) {
      action()
      return
    }
    if (loading) return
    notify(message, 'info')
    router.push('/login')
  }

  const roleLabel = (r?: string) =>
    r === 'ADMIN' ? 'مدیر' : r === 'OWNER' ? 'مالک' : 'اجاره‌گیرنده'

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 rounded-full md:hidden" aria-label="منو">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <BrandMark className="size-7" />
                دسته‌بندی‌ها
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                className="w-full justify-between rounded-xl"
                onClick={() => {
                  go({ name: 'new-listing' })
                  setMobileOpen(false)
                }}
              >
                <span className="flex items-center gap-2">
                  <Plus className="size-4" /> ثبت آگهی
                </span>
                <span aria-hidden="true">←</span>
              </Button>
              {!user && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" asChild>
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <LogIn className="size-4" /> ورود
                    </Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      <UserPlus className="size-4" /> ثبت‌نام
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <nav className="mt-4 flex flex-col gap-1 border-t pt-4">
              {NAV_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    go({ name: 'browse', categorySlug: c.slug })
                    setMobileOpen(false)
                  }}
                  className="rounded-lg px-3 py-2 text-right text-sm font-medium transition-colors hover:bg-muted"
                >
                  {c.label}
                </button>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="relative flex-1"
                  onClick={() =>
                    requireLogin('برای مشاهدهٔ پیام‌ها ابتدا وارد شوید.', () => {
                      openInbox()
                      setMobileOpen(false)
                    })
                  }
                >
                  <MessageSquare className="size-4" /> پیام‌ها
                  {unread > 0 && (
                    <span className="absolute left-2 top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-4 text-white">
                      {toPersianDigits(unread > 9 ? '۹+' : unread)}
                    </span>
                  )}
                </Button>
                <NotificationBell />
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  requireLogin('برای مشاهدهٔ داشبورد ابتدا وارد شوید.', () => {
                    go({ name: 'dashboard' })
                    setMobileOpen(false)
                  })
                }
              >
                <LayoutDashboard className="size-4" /> داشبورد
              </Button>
              {user?.role === 'ADMIN' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    go({ name: 'admin' })
                    setMobileOpen(false)
                  }}
                >
                  <Shield className="size-4" /> مدیریت
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <button
          onClick={() => go({ name: 'home' })}
          className="flex shrink-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="خانه اجاره‌بان"
        >
          <BrandMark className="size-9 shadow-sm sm:size-10" />
          <span className="hidden text-xl font-extrabold tracking-tight sm:block">
            اجاره‌بان
          </span>
        </button>

        {/* Center: primary navigation on home/browse, search elsewhere */}
        {view.name === 'home' || view.name === 'browse' ? (
          <nav className="mx-auto hidden flex-1 items-center justify-center gap-1 lg:flex">
            <button
              onClick={() => go({ name: 'home' })}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                view.name === 'home'
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              خانه
            </button>
            <button
              onClick={() => go({ name: 'browse' })}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                view.name === 'browse' &&
                  !('categorySlug' in view && view.categorySlug)
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              همه آگهی‌ها
            </button>
            <button
              onClick={() =>
                requireLogin('برای مشاهدهٔ داشبورد ابتدا وارد شوید.', () =>
                  go({ name: 'dashboard' }),
                )
              }
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              داشبورد
            </button>
          </nav>
        ) : (
          <form
            onSubmit={submitSearch}
            className="relative mx-auto hidden w-full max-w-md flex-1 md:block"
          >
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در آگهی‌ها…"
              className="h-10 rounded-full border-transparent bg-muted/60 pr-9 pl-4 focus-visible:border-ring focus-visible:bg-background"
            />
          </form>
        )}

        {/* Desktop actions */}
        <div className="hidden items-center gap-0.5 md:flex">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            onClick={() =>
              requireLogin('برای مشاهدهٔ پیام‌ها ابتدا وارد شوید.', openInbox)
            }
            aria-label="پیام‌ها"
          >
            <MessageSquare className="size-4" />
            {unread > 0 && (
              <span className="absolute -left-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-4 text-white">
                {toPersianDigits(unread > 9 ? '۹+' : unread)}
              </span>
            )}
          </Button>
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="تغییر تم"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {mounted && theme === 'dark' ? (
            <Sun className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
        </Button>

        {/* List item */}
        <Button
          size="sm"
          className="hidden rounded-full px-4 shadow-sm sm:inline-flex"
          onClick={() => go({ name: 'new-listing' })}
        >
          <Plus className="size-4" /> ثبت آگهی
        </Button>

        {/* Account / session */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {user ? (
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="حساب کاربری">
                <Avatar className="size-9">
                  <AvatarImage src={user.avatar || undefined} alt={user.name || ''} />
                  <AvatarFallback>
                    <UserRound className="size-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 rounded-full px-3"
                aria-label="ورود یا ثبت‌نام"
              >
                <UserRound className="size-4" />
                <span className="hidden sm:inline">ورود</span>
              </Button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60" sideOffset={8}>
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{user?.name ?? 'مهمان'}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">{roleLabel(user?.role)}</Badge>
                {user?.isIdentityVerified && (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    تأییدشده
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user ? (
              <>
                <DropdownMenuItem onClick={() => go({ name: 'dashboard', tab: 'bookings' })}>
                  <LayoutDashboard className="size-4" /> داشبورد
                </DropdownMenuItem>
                {user.role === 'ADMIN' && (
                  <DropdownMenuItem onClick={() => go({ name: 'admin', tab: 'listings' })}>
                    <Shield className="size-4" /> پنل مدیر
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4" /> خروج از حساب
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/login">
                    <LogIn className="size-4" /> ورود به حساب
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/register">
                    <UserPlus className="size-4" /> ثبت‌نام
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category strip (desktop) */}
      <div className="hidden border-t bg-card/50 md:block">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 overflow-x-auto px-4 no-scrollbar">
          <button
            onClick={() => go({ name: 'browse' })}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
              view.name === 'browse' && !('categorySlug' in view && view.categorySlug) &&
                'bg-primary/10 text-primary',
            )}
          >
            همه آگهی‌ها
          </button>
          {NAV_CATEGORIES.map((c) => {
            const active =
              view.name === 'browse' &&
              'categorySlug' in view &&
              view.categorySlug === c.slug
            return (
              <button
                key={c.slug}
                onClick={() => go({ name: 'browse', categorySlug: c.slug })}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
                  active && 'bg-primary/10 text-primary',
                )}
              >
                {c.label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span className="hidden items-center gap-1 lg:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              قابل اعتماد · تأییدشده · ودیعه امن
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
