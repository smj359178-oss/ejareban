'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
import { toPersianDigits } from '@/lib/persian'

const NAV_CATEGORIES = [
  { slug: 'electronics', label: 'الکترونیک' },
  { slug: 'cameras', label: 'دوربین' },
  { slug: 'tools', label: 'ابزار' },
  { slug: 'events', label: 'مراسم' },
  { slug: 'sports', label: 'ورزش' },
  { slug: 'vehicles', label: 'وسایل نقلیه' },
]

export function Navbar() {
  const { go, view, notify } = useNav()
  const { theme, setTheme } = useTheme()
  const { user, loading, logout } = useSession()
  const openInbox = useChatStore((s) => s.openInbox)
  const { unread } = useChatInbox(user?.id)
  const [q, setQ] = React.useState('')
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

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
    window.location.href = '/login'
  }

  const roleLabel = (r?: string) =>
    r === 'ADMIN' ? 'مدیر' : r === 'OWNER' ? 'مالک' : 'اجاره‌گیرنده'

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="منو">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>دسته‌بندی‌ها</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1">
              {NAV_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    go({ name: 'browse', categorySlug: c.slug })
                    setMobileOpen(false)
                  }}
                  className="rounded-md px-3 py-2 text-right text-sm font-medium hover:bg-muted"
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
          className="flex items-center gap-2"
          aria-label="خانه اجاره‌بان"
        >
          <Image
            src="/brand/logo-mark.png"
            alt="اجاره‌بان"
            width={36}
            height={36}
            className="size-9 rounded-xl shadow-sm"
          />
          <span className="hidden text-lg font-bold tracking-tight sm:block">
            اجاره‌بان
          </span>
        </button>

        {/* Search */}
        <form onSubmit={submitSearch} className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی لپ‌تاپ، دوربین، ابزار…"
            className="h-10 rounded-full pr-9 pl-4"
          />
        </form>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1 md:flex">
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={() =>
              requireLogin('برای مشاهدهٔ پیام‌ها ابتدا وارد شوید.', openInbox)
            }
            aria-label="پیام‌ها"
          >
            <MessageSquare className="size-4" /> پیام‌ها
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-4 text-white">
                {toPersianDigits(unread > 9 ? '۹+' : unread)}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              requireLogin('برای مشاهدهٔ داشبورد ابتدا وارد شوید.', () =>
                go({ name: 'dashboard' }),
              )
            }
          >
            <LayoutDashboard className="size-4" /> داشبورد
          </Button>
          {user?.role === 'ADMIN' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go({ name: 'admin' })}
            >
              <Shield className="size-4" /> مدیریت
            </Button>
          )}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
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
          className="hidden sm:inline-flex"
          onClick={() => go({ name: 'new-listing' })}
        >
          <Plus className="size-4" /> ثبت آگهی
        </Button>

        {/* Account / session */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="حساب کاربری">
              <Avatar className="size-9">
                <AvatarImage src={user?.avatar || undefined} alt={user?.name || ''} />
                <AvatarFallback>
                  <UserRound className="size-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
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
