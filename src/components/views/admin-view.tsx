'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Shield,
  Users,
  Package,
  CalendarCheck,
  Flag,
  BadgeCheck,
  ChevronLeft,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import { useNav } from '@/lib/store'
import { useFetch } from '@/hooks/use-fetch'
import { useSession } from '@/hooks/use-session'
import { formatToman, formatTomanCompact, timeAgo, formatDateShort } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { REPORT_REASONS_FA } from '@/lib/constants'
import type { BookingDTO, ListingDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const LISTING_MODERATION_LABELS_FA: Record<string, string> = {
  approved: 'تأیید شد',
  rejected: 'رد شد',
}

const REPORT_STATUS_LABELS_FA: Record<string, string> = {
  resolved: 'بررسی شد',
  dismissed: 'رد شد',
}

const VERIFICATION_STATUS_LABELS_FA: Record<string, string> = {
  approved: 'تأیید شد',
  rejected: 'رد شد',
}

export function AdminView({ tab }: { tab?: string }) {
  const back = useNav((s) => s.back)
  const { user, loading } = useSession()
  const [activeTab, setActiveTab] = React.useState(tab || 'listings')

  React.useEffect(() => {
    if (tab) setActiveTab(tab)
  }, [tab])

  // Gate (bug 23): spinner while the session resolves, login panel for
  // guests, and the admin-only panel for non-admin users.
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
          <span className="text-sm">در حال بارگذاری…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Shield className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-xl font-bold">برای ورود به پنل مدیریت وارد شوید.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          مدیریت آگهی‌ها، رزروها و گزارش‌ها نیازمند حساب مدیر است.
        </p>
        <Button asChild className="mt-5">
          <a href="/login">ورود به حساب</a>
        </Button>
      </div>
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Shield className="mx-auto mb-3 size-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">دسترسی مدیر لازم است</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          برای ورود به پنل مدیر، با حساب مدیر وارد شوید.
        </p>
        <Button asChild className="mt-4">
          <a href="/login">ورود به حساب مدیر</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <button
        onClick={back}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl-flip" /> بازگشت
      </button>
      <div className="flex items-center gap-2">
        <Shield className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">کنسول مدیریت</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        مدیریت آگهی‌ها، رزروها، گزارش‌ها و احراز هویت.
      </p>

      <StatsRow />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="listings">آگهی‌ها</TabsTrigger>
          <TabsTrigger value="bookings">رزروها</TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
          <TabsTrigger value="reports">گزارش‌ها</TabsTrigger>
          <TabsTrigger value="verifications">احراز هویت</TabsTrigger>
        </TabsList>

        {activeTab === 'listings' && <ModerationQueue />}
        {activeTab === 'bookings' && <BookingsOverview />}
        {activeTab === 'users' && <UsersOverview />}
        {activeTab === 'reports' && <ReportsQueue />}
        {activeTab === 'verifications' && <VerificationsQueue />}
      </Tabs>
    </div>
  )
}

function StatsRow() {
  const { data } = useFetch<{
    stats: {
      totalUsers: number
      owners: number
      totalListings: number
      pendingListings: number
      activeListings: number
      totalBookings: number
      pendingBookings: number
      openReports: number
      pendingVerifications: number
      platformRevenue: number
      gmv: number
    }
    recentBookings: {
      id: string
      title: string
      renter: string
      days: number
      total: number
      status: string
      createdAt: string
    }[]
  }>('/api/admin/stats')

  const s = data?.stats
  const stats = [
    { label: 'کل کاربران', value: toPersianDigits(s?.totalUsers ?? 0), icon: Users, tone: 'text-sky-600' },
    { label: 'آگهی‌های فعال', value: toPersianDigits(s?.activeListings ?? 0), icon: Package, tone: 'text-emerald-600' },
    { label: 'کل رزروها', value: toPersianDigits(s?.totalBookings ?? 0), icon: CalendarCheck, tone: 'text-violet-600' },
    { label: 'درآمد پلتفرم', value: formatTomanCompact(s?.platformRevenue ?? 0), icon: DollarSign, tone: 'text-amber-600' },
  ]
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((st) => (
        <Card key={st.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{st.label}</span>
              <st.icon className={cn('size-4', st.tone)} />
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              {st.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ModerationQueue() {
  const { data, loading, reload } = useFetch<{ listings: ListingDTO[] }>(
    '/api/admin/listings?status=pending',
  )
  const notify = useNav((s) => s.notify)
  const [busy, setBusy] = React.useState<string | null>(null)
  const listings = data?.listings ?? []

  async function moderate(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusy(id)
    try {
      const r = await fetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationStatus: status }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        notify(d?.error ?? 'عملیات ناموفق بود', 'error')
        return
      }
      const label = LISTING_MODERATION_LABELS_FA[status.toLowerCase()] ?? status.toLowerCase()
      notify(`آگهی ${label}.`, 'success')
      reload()
    } catch {
      notify('اتصال به سرور ناموفق بود', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
  if (listings.length === 0)
    return (
      <div className="mt-5 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
        آگهی‌ای در انتظار تأیید نیست.
      </div>
    )

  return (
    <div className="mt-5 space-y-3">
      {listings.map((l) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
              {l.images[0] && (
                <Image src={l.images[0]} alt={l.title} fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{l.title}</div>
              <div className="text-xs text-muted-foreground">
                {l.city} · {l.brand} · توسط {l.owner.name}
              </div>
              <div className="mt-1 text-xs">
                {formatToman(l.dailyPrice)}/روز · ودیعه {formatToman(l.deposit)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy === l.id}
                onClick={() => moderate(l.id, 'APPROVED')}
              >
                <CheckCircle2 className="size-4" /> تأیید
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === l.id}
                onClick={() => moderate(l.id, 'REJECTED')}
              >
                <XCircle className="size-4" /> رد
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BookingsOverview() {
  // W1 — real admin bookings management: full list + status filter + paging
  // + تأیید/رد/لغو actions backed by PATCH /api/admin/bookings/[id].
  // Previously this tab rendered only the last 6 rows from /api/admin/stats
  // with zero actions — admins could never move a booking forward.
  const notify = useNav((s) => s.notify)
  const [status, setStatus] = React.useState<string>('PENDING')
  const [page, setPage] = React.useState(1)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [noteFor, setNoteFor] = React.useState<{ id: string; action: string } | null>(null)
  const [note, setNote] = React.useState('')

  const { data, loading, reload } = useFetch<{
    bookings: BookingDTO[]
    total: number
    page: number
    pages: number
  }>(`/api/admin/bookings?status=${status}&page=${page}&limit=20`, [status, page])

  const rows = data?.bookings ?? []
  const pages = data?.pages ?? 1

  const STATUS_FILTERS = [
    { value: 'PENDING', label: 'در انتظار بررسی' },
    { value: 'APPROVED', label: 'تأییدشده' },
    { value: 'ACTIVE', label: 'در حال اجاره' },
    { value: 'COMPLETED', label: 'تکمیل‌شده' },
    { value: 'DECLINED', label: 'ردشده' },
    { value: 'CANCELLED', label: 'لغوشده' },
    { value: 'ALL', label: 'همه' },
  ]

  async function act(id: string, action: 'review-approve' | 'decline' | 'cancel', noteText?: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: noteText || undefined }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'عملیات ناموفق بود')
      notify(
        action === 'review-approve'
          ? 'بررسی ادمین ثبت شد؛ به مشتری و مالک اطلاع داده شد.'
          : action === 'decline'
            ? 'رزرو رد شد و به طرفین اطلاع داده شد.'
            : 'رزرو لغو شد و به طرفین اطلاع داده شد.',
        'success',
      )
      reload()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'عملیات ناموفق بود', 'error')
    } finally {
      setBusyId(null)
      setNoteFor(null)
      setNote('')
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? 'default' : 'outline'}
            onClick={() => {
              setStatus(f.value)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          رزروی با این وضعیت وجود ندارد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-right text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">آگهی</th>
                <th className="px-3 py-2.5 font-medium">اجاره‌گیرنده</th>
                <th className="px-3 py-2.5 font-medium">مالک</th>
                <th className="px-3 py-2.5 font-medium">تاریخ‌ها</th>
                <th className="px-3 py-2.5 font-medium">مجموع</th>
                <th className="px-3 py-2.5 font-medium">وضعیت</th>
                <th className="px-3 py-2.5 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="max-w-40 truncate px-3 py-3 font-medium">{b.listing.title}</td>
                  <td className="px-3 py-3 text-muted-foreground">{b.renter.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{b.owner.name}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatDateShort(b.startDate)} → {formatDateShort(b.endDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{formatToman(b.totalAmount)}</td>
                  <td className="px-3 py-3">
                    <BookingStatusBadge status={b.status} />
                    {b.status === 'PENDING' && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {b.adminApprovedAt ? 'ادمین بررسی کرد' : 'در انتظار بررسی ادمین'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {b.status === 'PENDING' && !b.adminApprovedAt && (
                        <Button
                          size="sm"
                          disabled={busyId === b.id}
                          onClick={() => act(b.id, 'review-approve')}
                        >
                          <CheckCircle2 className="size-3.5" /> تأیید
                        </Button>
                      )}
                      {b.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === b.id}
                          onClick={() => setNoteFor({ id: b.id, action: 'decline' })}
                        >
                          <XCircle className="size-3.5" /> رد
                        </Button>
                      )}
                      {(b.status === 'PENDING' || b.status === 'APPROVED') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === b.id}
                          onClick={() => setNoteFor({ id: b.id, action: 'cancel' })}
                        >
                          لغو
                        </Button>
                      )}
                      {busyId === b.id && <Loader2 className="size-4 animate-spin" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* paging */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحهٔ {toPersianDigits(page)} از {toPersianDigits(pages)} · {toPersianDigits(data?.total ?? 0)} رزرو
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            بعدی
          </Button>
        </div>
      )}

      {/* note dialog for decline/cancel */}
      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>دلیل {noteFor?.action === 'decline' ? 'رد رزرو' : 'لغو رزرو'} (اختیاری)</DialogTitle>
            <DialogDescription>
              این متن برای اجاره‌گیرنده و مالک ارسال می‌شود.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteFor(null)}>
              انصراف
            </Button>
            <Button
              variant={noteFor?.action === 'decline' ? 'destructive' : 'default'}
              disabled={busyId !== null}
              onClick={() => noteFor && act(noteFor.id, noteFor.action as 'decline' | 'cancel', note.trim())}
            >
              تأیید {noteFor?.action === 'decline' ? 'رد' : 'لغو'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportsQueue() {
  const { data, loading, reload } = useFetch<{
    reports: {
      id: string
      reason: string
      description: string | null
      status: string
      createdAt: string
      reporter: { id: string; name: string; avatar: string | null }
      listing: {
        id: string
        title: string
        slug: string
        images: string[]
      } | null
    }[]
  }>('/api/admin/reports?status=OPEN')
  const notify = useNav((s) => s.notify)
  const [busy, setBusy] = React.useState<string | null>(null)
  const reports = data?.reports ?? []
  const go = useNav((s) => s.go)

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    setBusy(id)
    try {
      const r = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        notify(d?.error ?? 'عملیات ناموفق بود', 'error')
        return
      }
      const label = REPORT_STATUS_LABELS_FA[status.toLowerCase()] ?? status.toLowerCase()
      notify(`گزارش ${label}.`, 'success')
      reload()
    } catch {
      notify('اتصال به سرور ناموفق بود', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
  if (reports.length === 0)
    return (
      <div className="mt-5 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        گزارش باز وجود ندارد.
      </div>
    )
  return (
    <div className="mt-5 space-y-3">
      {reports.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {r.listing && (
                <button
                  onClick={() => go({ name: 'listing', slug: r.listing!.slug })}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                >
                  {r.listing.images[0] && (
                    <Image src={r.listing.images[0]} alt={r.listing.title} fill sizes="64px" className="object-cover" />
                  )}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="capitalize">
                    {REPORT_REASONS_FA[r.reason] ?? r.reason}
                  </Badge>
                  {r.listing && (
                    <span className="truncate text-sm font-medium">
                      {r.listing.title}
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="size-5">
                    <AvatarImage src={r.reporter.avatar || undefined} />
                    <AvatarFallback>{r.reporter.name[0]}</AvatarFallback>
                  </Avatar>
                  {r.reporter.name} · {timeAgo(r.createdAt)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => resolve(r.id, 'DISMISSED')}
                >
                  رد کردن
                </Button>
                <Button
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => resolve(r.id, 'RESOLVED')}
                >
                  بررسی شد
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UsersOverview() {
  const { data, loading, reload } = useFetch<{
    users: {
      id: string
      email: string
      username: string | null
      name: string
      firstName: string | null
      lastName: string | null
      role: string
      city: string | null
      avatar: string | null
      isIdentityVerified: boolean
      isPhoneVerified: boolean
      trustScore: number
      trustTier: string
      ratingCount: number
      rentalsCompleted: number
      listingsCount: number
      bookingsAsRenter: number
      createdAt: string
    }[]
  }>('/api/admin/users?limit=200')
  const [q, setQ] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState<'ALL' | 'USER' | 'OWNER' | 'ADMIN'>('ALL')
  const rows = (data?.users ?? []).filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
    if (!q) return true
    const haystack = `${u.name} ${u.email} ${u.username ?? ''}`.toLowerCase()
    return haystack.includes(q.toLowerCase())
  })

  const roleLabels: Record<string, string> = {
    ADMIN: 'مدیر',
    OWNER: 'مالک',
    USER: 'اجاره‌گیرنده',
  }
  const roleBadgeClass: Record<string, string> = {
    ADMIN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    OWNER: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    USER: 'bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200',
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو با نام، ایمیل یا نام کاربری…"
          className="max-w-sm"
        />
        <div className="flex gap-1.5">
          {(['ALL', 'USER', 'OWNER', 'ADMIN'] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={roleFilter === r ? 'default' : 'outline'}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'ALL' ? 'همه' : roleLabels[r]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={reload}>
          <Users className="size-4" /> به‌روزرسانی
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          کاربری مطابق فیلترها یافت نشد.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">کاربر</th>
                <th className="px-3 py-2.5 font-medium">نقش</th>
                <th className="px-3 py-2.5 font-medium">شهر</th>
                <th className="px-3 py-2.5 font-medium">آگهی‌ها</th>
                <th className="px-3 py-2.5 font-medium">اجاره‌ها</th>
                <th className="px-3 py-2.5 font-medium">امتیاز</th>
                <th className="px-3 py-2.5 font-medium">عضویت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={u.avatar || undefined} />
                        <AvatarFallback>{u.name?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground" dir="ltr">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="secondary" className={roleBadgeClass[u.role] ?? ''}>
                      {roleLabels[u.role] ?? u.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{u.city || '—'}</td>
                  <td className="px-3 py-3">{toPersianDigits(u.listingsCount)}</td>
                  <td className="px-3 py-3">{toPersianDigits(u.bookingsAsRenter)}</td>
                  <td className="px-3 py-3">
                    <span className="font-mono">{toPersianDigits(u.trustScore)}</span>
                    <span className="text-xs text-muted-foreground">/۱۰۰</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {timeAgo(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function VerificationsQueue() {
  const { data, loading, reload } = useFetch<{
    requests: {
      id: string
      nationalId: string
      phone: string
      status: string
      createdAt: string
      user: {
        id: string
        name: string
        avatar: string | null
        email: string
        city: string | null
      }
    }[]
  }>('/api/admin/verifications')
  const notify = useNav((s) => s.notify)
  const [busy, setBusy] = React.useState<string | null>(null)
  const reqs = data?.requests ?? []

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusy(id)
    try {
      const r = await fetch(`/api/admin/verifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        notify(d?.error ?? 'عملیات ناموفق بود', 'error')
        return
      }
      const label = VERIFICATION_STATUS_LABELS_FA[status.toLowerCase()] ?? status.toLowerCase()
      notify(`احراز هویت ${label}.`, 'success')
      reload()
    } catch {
      notify('اتصال به سرور ناموفق بود', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
  if (reqs.length === 0)
    return (
      <div className="mt-5 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        <BadgeCheck className="mx-auto mb-2 size-6 text-emerald-500" />
        احراز هویت در انتظاری وجود ندارد.
      </div>
    )
  return (
    <div className="mt-5 space-y-3">
      {reqs.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarImage src={r.user.avatar || undefined} />
                <AvatarFallback>{r.user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.user.email} · {r.user.city || '—'}
                </div>
                <Separator className="my-2" />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>کد ملی: <span className="font-mono text-foreground">{r.nationalId}</span></span>
                  <span>تلفن: <span className="font-mono text-foreground">{r.phone}</span></span>
                  <span>ارسال‌شده {timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r.id, 'REJECTED')}>
                  رد
                </Button>
                <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, 'APPROVED')}>
                  <BadgeCheck className="size-4" /> تأیید هویت
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
