'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  CalendarCheck,
  Package,
  Heart,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  FileText,
  Loader2,
  LayoutDashboard,
  PenLine,
  CreditCard,
  PackageCheck,
  Undo2,
  HandCoins,
  AlertTriangle,
  CalendarOff,
  CalendarRange,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import { useNav } from '@/lib/store'
import { useFetch } from '@/hooks/use-fetch'
import { useSession } from '@/hooks/use-session'
import type { BookingDTO, ListingDTO } from '@/lib/types'
import { formatToman, formatDate } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { cn } from '@/lib/utils'

const PAYMENT_STATUS_LABELS_FA: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  REFUNDED: 'بازپرداخت‌شده',
  FAILED: 'ناموفق',
}

export function DashboardView({ tab }: { tab?: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const { user, loading } = useSession()
  const [activeTab, setActiveTab] = React.useState(tab || 'bookings')

  React.useEffect(() => {
    if (tab) setActiveTab(tab)
  }, [tab])

  // All dashboard endpoints require a session — fetch nothing for guests
  // (null url) so the login gate below never produces raw 401 noise.
  const { data: bookData, reload } = useFetch<{ bookings: BookingDTO[] }>(
    user ? '/api/bookings' : null,
  )
  const { data: favData } = useFetch<{ favorites: string[] }>(
    user ? '/api/favorites' : null,
  )
  // Fetch only the current user's own listings via the dedicated owner=self
  // filter on /api/listings. This returns listings in any moderation status
  // (PENDING, APPROVED, REJECTED) so the dashboard can show the full picture.
  const { data: myListingsData } = useFetch<{ listings: ListingDTO[] }>(
    user ? '/api/listings?owner=self&limit=100' : null,
  )
  const { data: favListingsData } = useFetch<{ listings: ListingDTO[] }>(
    user ? '/api/favorites?detail=1' : null,
  )

  const bookings = bookData?.bookings ?? []
  const favoriteIds = new Set(favData?.favorites ?? [])
  const myListings = myListingsData?.listings ?? []
  const favListings = favListingsData?.listings ?? []
  const favoriteListings =
    favListings.length > 0
      ? favListings
      : myListings.filter((l) => favoriteIds.has(l.id))

  const myRentals = bookings.filter((b) => b.renter.id === user?.id)
  const myRequests = bookings.filter((b) => b.owner.id === user?.id)

  // Login gate: wait for the session to resolve first.
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
        <LayoutDashboard className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-xl font-bold">برای مشاهدهٔ داشبورد وارد شوید</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          رزروها، آگهی‌ها و علاقه‌مندی‌های شما اینجا نمایش داده می‌شود.
        </p>
        <Button asChild className="mt-5">
          <a href="/login">ورود به حساب</a>
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
      <h1 className="text-2xl font-bold tracking-tight">داشبورد من</h1>
      <p className="text-sm text-muted-foreground">
        مدیریت رزروها، آگهی‌ها و موارد ذخیره‌شده.
      </p>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-5"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="bookings" className="gap-1.5">
            <CalendarCheck className="size-4" /> رزروها
          </TabsTrigger>
          <TabsTrigger value="listings" className="gap-1.5">
            <Package className="size-4" /> آگهی‌ها
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="size-4" /> علاقه‌مندی‌ها
          </TabsTrigger>
        </TabsList>

        {activeTab === 'bookings' && (
          <div className="mt-5 space-y-6">
            {bookings.length === 0 && (
              <EmptyState
                icon={CalendarCheck}
                title="هنوز رزروی ندارید"
                desc="برای ثبت اولین رزرو، آگهی‌ها را ببینید."
                cta="مشاهده آگهی‌ها"
                onCta={() => go({ name: 'browse' })}
              />
            )}

            {myRentals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  اجاره‌های من ({toPersianDigits(myRentals.length)})
                </h3>
                {myRentals.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onAction={reload}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}

            {myRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  درخواست‌های دریافتی ({toPersianDigits(myRequests.length)})
                </h3>
                {myRequests.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onAction={reload}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'listings' && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {toPersianDigits(myListings.length)} آگهی در پلتفرم
              </p>
              <Button size="sm" onClick={() => go({ name: 'new-listing' })}>
                <Package className="size-4" /> آگهی جدید
              </Button>
            </div>
            {myListings.length === 0 ? (
              <EmptyState
                icon={Package}
                title="هنوز آگهی‌ای ندارید"
                desc="اولین کالای خود را ثبت کنید و درآمدزایی را شروع کنید."
                cta="ثبت آگهی"
                onCta={() => go({ name: 'new-listing' })}
              />
            ) : (
              myListings.slice(0, 20).map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="mt-5">
            {favoriteListings.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="علاقه‌مندی‌ای ندارید"
                desc="روی قلب هر آگهی بزنید تا اینجا ذخیره شود."
                cta="مشاهده آگهی‌ها"
                onCta={() => go({ name: 'browse' })}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {favoriteListings.map((l) => (
                  <Card
                    key={l.id}
                    className="cursor-pointer overflow-hidden"
                    onClick={() => go({ name: 'listing', slug: l.slug })}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {l.images[0] && (
                        <Image
                          src={l.images[0]}
                          alt={l.title}
                          fill
                          sizes="300px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="truncate text-sm font-medium">
                        {l.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatToman(l.dailyPrice)}/روز
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------
// Listing row (dashboard → آگهی‌ها) + W10 calendar manager dialog
// ---------------------------------------------------------------------
function ListingRow({ listing }: { listing: ListingDTO }) {
  const go = useNav((s) => s.go)
  const notify = useNav((s) => s.notify)
  const [calOpen, setCalOpen] = React.useState(false)

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-3">
        <div
          className="relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted"
          onClick={() => go({ name: 'listing', slug: listing.slug })}
        >
          {listing.images[0] && (
            <Image
              src={listing.images[0]}
              alt={listing.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          )}
        </div>
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => go({ name: 'listing', slug: listing.slug })}
        >
          <div className="truncate font-medium">{listing.title}</div>
          <div className="text-xs text-muted-foreground">
            {listing.city} · {formatToman(listing.dailyPrice)}/روز
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={
                listing.moderationStatus === 'PENDING'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  : listing.moderationStatus === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              }
            >
              {listing.moderationStatus === 'PENDING'
                ? 'در انتظار تأیید'
                : listing.moderationStatus === 'REJECTED'
                  ? 'رد شده'
                  : 'تأیید شده'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{toPersianDigits(listing.bookingsCount)} رزرو</Badge>
            <span className="text-xs text-muted-foreground">
              {toPersianDigits(listing.views)} بازدید
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setCalOpen(true)
            }}
          >
            <CalendarRange className="size-4" /> مدیریت تقویم
          </Button>
        </div>
        <CalendarManagerDialog
          listing={listing}
          open={calOpen}
          onOpenChange={setCalOpen}
          onSaved={() => notify('تقویم به‌روزرسانی شد.', 'success')}
        />
      </CardContent>
    </Card>
  )
}

/**
 * W10 — owner blocks/unblocks days on their listing's availability calendar.
 * Date inputs use LOCAL day keys (YYYY-MM-DD) matching the B1 convention.
 */
function CalendarManagerDialog({
  listing,
  open,
  onOpenChange,
  onSaved,
}: {
  listing: ListingDTO
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved?: () => void
}) {
  const notify = useNav((s) => s.notify)
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [blocked, setBlocked] = React.useState<
    { date: string; reason: string }[]
  >([])
  const [loading, setLoading] = React.useState(false)

  const loadBlocked = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/listings/${listing.slug}/availability`)
      const d = await r.json()
      setBlocked((d.blockedDates ?? []).map((date: string) => ({ date, reason: '' })))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [listing.slug])

  React.useEffect(() => {
    if (open) loadBlocked()
  }, [open, loadBlocked])

  async function blockDays() {
    if (!start) {
      notify('تاریخ شروع را انتخاب کنید.', 'error')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(`/api/listings/${listing.slug}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end || start }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'بلاک کردن ناموفق بود')
      notify(`${toPersianDigits(d.blocked ?? 1)} روز بلاک شد.`, 'success')
      setStart('')
      setEnd('')
      loadBlocked()
      onSaved?.()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function unblockDays() {
    if (!start) {
      notify('بازهٔ رفع بلاک را انتخاب کنید.', 'error')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(`/api/listings/${listing.slug}/availability`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end || start }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'رفع بلاک ناموفق بود')
      notify(`${toPersianDigits(d.unblocked ?? 0)} روز آزاد شد.`, 'success')
      setStart('')
      setEnd('')
      loadBlocked()
      onSaved?.()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            مدیریت تقویم — {listing.title}
          </DialogTitle>
          <DialogDescription>
            روزهایی که کالا در دسترس نیست (نگهداری، تعمیر، رزرو شخصی) را بلاک
            کنید تا کسی بتواند آن‌ها را رزرو نکند.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cal-start">از تاریخ</Label>
            <Input
              id="cal-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-end">تا تاریخ (اختیاری)</Label>
            <Input
              id="cal-end"
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={blockDays} disabled={busy || !start}>
            <CalendarOff className="size-4" /> بلاک کردن
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={unblockDays}
            disabled={busy || !start}
          >
            آزاد کردن
          </Button>
        </div>

        <Separator />
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            روزهای غیرقابل رزرو ({toPersianDigits(blocked.length)})
          </h4>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : blocked.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              هیچ روزی بلاک نشده است.
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {blocked.map((b) => (
                <Badge key={b.date} variant="secondary" className="font-mono text-[11px]">
                  {b.date}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Booking row — full 12-step lifecycle actions
// ---------------------------------------------------------------------
function BookingRow({
  booking,
  onAction,
  currentUserId,
}: {
  booking: BookingDTO
  onAction: () => void
  currentUserId?: string
}) {
  const notify = useNav((s) => s.notify)
  const go = useNav((s) => s.go)
  const [busy, setBusy] = React.useState(false)
  const [signOpen, setSignOpen] = React.useState(false)
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const isOwner = booking.owner.id === currentUserId
  const isRenter = booking.renter.id === currentUserId

  async function act(status: string) {
    setBusy(true)
    try {
      const r = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'عملیات ناموفق بود')
      notify('وضعیت رزرو به‌روزرسانی شد.', 'success')
      onAction()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'عملیات ناموفق بود', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function lifecycleCall(
    path: string,
    body: Record<string, unknown> = {},
    successMsg = 'انجام شد.',
  ) {
    setBusy(true)
    try {
      const r = await fetch(`/api/bookings/${booking.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'عملیات ناموفق بود')
      notify(successMsg, 'success')
      onAction()
      return true
    } catch (e) {
      notify(e instanceof Error ? e.message : 'عملیات ناموفق بود', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const mySigned = isOwner ? !!booking.ownerSignedAt : !!booking.renterSignedAt
  const otherSigned = isOwner ? !!booking.renterSignedAt : !!booking.ownerSignedAt

  // Which lifecycle hint should we show?
  const stageHint = (() => {
    if (booking.status === 'PENDING') {
      if (!booking.adminApprovedAt)
        return { icon: ShieldCheck, text: 'در انتظار بررسی و تأیید تیم اجاره‌بان' }
      return {
        icon: ShieldCheck,
        text: isOwner
          ? 'ادمین بررسی کرد — آمادهٔ تأیید نهایی شما'
          : 'ادمین بررسی کرد — منتظر تأیید نهایی مالک',
      }
    }
    if (booking.status === 'APPROVED') {
      if (!mySigned && !otherSigned) return { icon: PenLine, text: 'قرارداد در انتظار امضای دو طرف' }
      if (!mySigned && otherSigned) return { icon: PenLine, text: 'طرف دیگر امضا کرد — نوبت امضای شماست' }
      if (mySigned && !otherSigned) return { icon: PenLine, text: 'شما امضا کردید — در انتظار امضای طرف دیگر' }
      if (booking.paymentStatus !== 'PAID')
        return {
          icon: CreditCard,
          text: isOwner ? 'قرارداد امضا شد — منتظر پرداخت اجاره‌گیرنده' : 'قرارداد امضا شد — نوبت پرداخت شما',
        }
      return { icon: PackageCheck, text: 'پرداخت شد — منتظر تحویل کالا' }
    }
    if (booking.status === 'ACTIVE') return { icon: Clock, text: 'در حال اجاره — پس از پایان، بازگشت را ثبت کنید' }
    if (booking.status === 'COMPLETED') {
      if (!booking.depositRefundedAt && booking.depositTotal > 0)
        return { icon: HandCoins, text: 'ودیعه در انتظار بازگشت' }
      if (!booking.settledAt && (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED'))
        return { icon: HandCoins, text: 'در انتظار تسویهٔ مبلغ با مالک' }
      return null
    }
    return null
  })()

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted"
            onClick={() => go({ name: 'listing', slug: booking.listing.slug })}
          >
            {booking.listing.images[0] && (
              <Image
                src={booking.listing.images[0]}
                alt={booking.listing.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => go({ name: 'listing', slug: booking.listing.slug })}
              className="text-right font-semibold hover:underline"
            >
              {booking.listing.title}
            </button>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {booking.listing.city}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-muted-foreground" />
                {formatDate(booking.startDate)} → {formatDate(booking.endDate)}{' '}
                · {toPersianDigits(booking.days)} روز
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BookingStatusBadge status={booking.status} />
              <Badge variant="outline">
                {PAYMENT_STATUS_LABELS_FA[booking.paymentStatus] ?? booking.paymentStatus}
              </Badge>
              {booking.contractSigned && (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  قرارداد امضا شد
                </Badge>
              )}
              {booking.settledAt && (
                <Badge variant="secondary">تسویه شد</Badge>
              )}
              {booking.depositRefundedAt && (
                <Badge variant="secondary">
                  ودیعه برگشت ({formatToman(booking.depositRefundAmount ?? 0)})
                </Badge>
              )}
              {booking.damageAmount != null && booking.damageAmount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" /> خسارت {formatToman(booking.damageAmount)}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm font-medium">
              مجموع: {formatToman(booking.totalAmount)}
            </div>
            {stageHint && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <stageHint.icon className="size-3.5 text-primary" />
                {stageHint.text}
              </div>
            )}
          </div>

          {/* -------- Actions column -------- */}
          <div className="flex flex-col items-end gap-2">
            {/* Renter actions */}
            {isRenter && booking.status === 'APPROVED' && mySigned && otherSigned && booking.paymentStatus !== 'PAID' && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  lifecycleCall('pay', {}, 'پرداخت با موفقیت انجام شد.')
                }
              >
                <CreditCard className="size-4" /> پرداخت {formatToman(booking.totalAmount)}
              </Button>
            )}
            {isRenter && (booking.status === 'PENDING' || booking.status === 'APPROVED') && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => act('CANCELLED')}
              >
                لغو
              </Button>
            )}

            {/* Owner actions */}
            {isOwner && booking.status === 'PENDING' && booking.adminApprovedAt && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => act('APPROVED')}>
                  <CheckCircle2 className="size-4" /> تأیید نهایی
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act('DECLINED')}>
                  <XCircle className="size-4" /> رد
                </Button>
              </div>
            )}
            {isOwner && booking.status === 'PENDING' && !booking.adminApprovedAt && (
              <span className="text-[11px] text-muted-foreground">
                منتظر بررسی ادمین…
              </span>
            )}
            {isOwner && booking.status === 'APPROVED' && booking.paymentStatus === 'PAID' && (
              <Button size="sm" disabled={busy} onClick={() => act('ACTIVE')}>
                <PackageCheck className="size-4" /> ثبت تحویل
              </Button>
            )}

            {/* Contract signing — both sides */}
            {booking.status === 'APPROVED' && !booking.contractSigned && (
              <Button
                size="sm"
                variant={mySigned ? 'ghost' : 'default'}
                disabled={busy || mySigned}
                onClick={() => setSignOpen(true)}
              >
                <PenLine className="size-4" />
                {mySigned
                  ? 'امضای شما ثبت شد'
                  : otherSigned
                    ? 'امضای قرارداد (طرف دیگر امضا کرد)'
                    : 'امضای قرارداد'}
              </Button>
            )}

            {/* Return — both sides can submit while ACTIVE */}
            {booking.status === 'ACTIVE' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setReturnOpen(true)}>
                <Undo2 className="size-4" /> ثبت بازگشت
              </Button>
            )}

            {/* Owner/admin: refund deposit after COMPLETED */}
            {isOwner && booking.status === 'COMPLETED' && !booking.depositRefundedAt && booking.depositTotal > 0 && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setRefundOpen(true)}>
                <HandCoins className="size-4" /> بازگشت ودیعه
              </Button>
            )}

            {/* Owner: settle payout after COMPLETED */}
            {isOwner && booking.status === 'COMPLETED' && !booking.settledAt && (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED') && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  lifecycleCall('settle', {}, 'تسویه با مالک انجام شد.')
                }
              >
                <HandCoins className="size-4" /> دریافت مبلغ اجاره
              </Button>
            )}

            {/* Review (W12) — after completion both sides */}
            {booking.status === 'COMPLETED' && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReviewOpen(true)}>
                <Star className="size-4" /> ثبت نظر
              </Button>
            )}

            {isOwner && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">
                شما مالک هستید
              </span>
            )}
            {isRenter && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-sky-600">
                شما اجاره‌گیرنده هستید
              </span>
            )}
            {/* دانلود قرارداد دیجیتال */}
            {['APPROVED', 'ACTIVE', 'COMPLETED'].includes(booking.status) && (
              <a
                href={`/api/bookings/${booking.id}/contract`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <FileText className="size-3.5" />
                دانلود قرارداد
              </a>
            )}
          </div>
        </div>

        {/* return / damage notes */}
        {booking.returnedAt && booking.returnNote && (
          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            یادداشت بازگشت: {booking.returnNote}
          </p>
        )}
        {booking.damageNote && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            خسارت اعلام‌شده: {booking.damageNote}
          </p>
        )}

        {/* Dialogs */}
        <SignDialog
          open={signOpen}
          onOpenChange={setSignOpen}
          booking={booking}
          role={isOwner ? 'OWNER' : 'RENTER'}
          onSigned={() => lifecycleCall('sign', { accept: true }, 'قرارداد امضا شد.')}
          busy={busy}
        />
        <ReturnDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          onSubmit={async (note, images) => {
            const ok = await lifecycleCall(
              'return',
              { note, images },
              'بازگشت کالا ثبت شد.',
            )
            if (ok) setReturnOpen(false)
          }}
          busy={busy}
        />
        <RefundDialog
          open={refundOpen}
          onOpenChange={setRefundOpen}
          booking={booking}
          onSubmit={async (damageNote, damageAmount) => {
            const ok = await lifecycleCall(
              'refund',
              { damageNote, damageAmount },
              'ودیعه بازگردانده شد.',
            )
            if (ok) setRefundOpen(false)
          }}
          busy={busy}
        />
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          booking={booking}
          onSubmit={async (rating, comment) => {
            const ok = await submitReview(booking.listing.id, rating, comment)
            if (ok) setReviewOpen(false)
          }}
          busy={busy}
        />
      </CardContent>
    </Card>
  )

  async function submitReview(listingId: string, rating: number, comment: string) {
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, rating, comment }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'ثبت نظر ناموفق بود')
      notify('نظر شما ثبت شد. ممنون!', 'success')
      return true
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ثبت نظر ناموفق بود', 'error')
      return false
    }
  }
}

// ---------------------------------------------------------------------
// Sign dialog (W4)
// ---------------------------------------------------------------------
function SignDialog({
  open,
  onOpenChange,
  booking,
  role,
  onSigned,
  busy,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  booking: BookingDTO
  role: 'OWNER' | 'RENTER'
  onSigned: () => Promise<boolean>
  busy: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5 text-primary" /> امضای قرارداد اجاره
          </DialogTitle>
          <DialogDescription>
            با امضای این قرارداد، شرایط اجارهٔ زیر را می‌پذیرید.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">
          <p className="font-semibold">{booking.listing.title}</p>
          <p className="mt-1 text-muted-foreground">
            {formatDate(booking.startDate)} تا {formatDate(booking.endDate)} ·{' '}
            {toPersianDigits(booking.days)} روز
          </p>
          <Separator className="my-3" />
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>مبلغ اجاره: {formatToman(booking.rentalPrice)}</li>
            <li>کارمزد سرویس: {formatToman(booking.serviceFee)}</li>
            <li>ودیعه (قابل بازگشت): {formatToman(booking.depositTotal)}</li>
            <li>مجموع: {formatToman(booking.totalAmount)}</li>
          </ul>
          <Separator className="my-3" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {role === 'OWNER'
              ? 'من مالک کالا هستم؛ تحویل کالای سالم در تاریخ مقرر را تعهد می‌کنم و تأیید می‌کنم ودیعه پس از بازگشت سالم کالا بازگردانده شود.'
              : 'من اجاره‌گیرنده هستم؛ نگهداری سالم کالا، بازگرداندن به‌موقع و پذیرش کسر ودیعه در صورت خسارت را تعهد می‌کنم.'}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={async () => {
              const ok = await onSigned()
              if (ok) onOpenChange(false)
            }}
            disabled={busy}
          >
            <PenLine className="size-4" /> امضا می‌کنم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Return dialog (W8)
// ---------------------------------------------------------------------
function ReturnDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (note: string, images: string[]) => Promise<void>
  busy: boolean
}) {
  const notify = useNav((s) => s.notify)
  const [note, setNote] = React.useState('')
  const [urls, setUrls] = React.useState<string[]>([])
  const [uploading, setUploading] = React.useState(0)
  const fileRef = React.useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading((n) => n + 1)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch('/api/upload', { method: 'POST', body: fd })
        const d = await r.json().catch(() => null)
        if (r.ok && d?.url) {
          setUrls((prev) => [...prev, d.url]) // functional setState (U7)
        } else {
          notify(d?.error || 'آپلود ناموفق بود', 'error')
        }
      }
    } finally {
      setUploading((n) => Math.max(0, n - 1)) // balanced decrement (U6)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-5 text-primary" /> ثبت بازگشت کالا
          </DialogTitle>
          <DialogDescription>
            وضعیت کالا هنگام بازگشت را توضیح دهید (اختیاری: عکس پیوست کنید).
            پس از ثبت، ودیعه قابل بازگشت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="مثلاً: کالا سالم و کامل بازگردانده شد."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
        />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading > 0}
          >
            {uploading > 0 ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageCheck className="size-4" />
            )}
            افزودن عکس {urls.length > 0 && `(${toPersianDigits(urls.length)})`}
          </Button>
          {urls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {urls.map((u) => (
                <div key={u} className="relative size-14 overflow-hidden rounded border">
                  <Image src={u} alt="عکس بازگشت" fill sizes="56px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={async () => {
              await onSubmit(note.trim(), urls)
              setNote('')
              setUrls([])
            }}
            disabled={busy || uploading > 0}
          >
            ثبت بازگشت
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Refund dialog (W7 + W9 damage deduction)
// ---------------------------------------------------------------------
function RefundDialog({
  open,
  onOpenChange,
  booking,
  onSubmit,
  busy,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  booking: BookingDTO
  onSubmit: (damageNote: string, damageAmount: number) => Promise<void>
  busy: boolean
}) {
  const [damage, setDamage] = React.useState('')
  const [note, setNote] = React.useState('')
  const damageNum = Number(damage) || 0
  const refund = Math.max(0, booking.depositTotal - damageNum)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="size-5 text-primary" /> بازگشت ودیعه
          </DialogTitle>
          <DialogDescription>
            ودیعهٔ {formatToman(booking.depositTotal)} نگهداری شده است. در صورت
            وجود خسارت، مبلغ کسری را وارد کنید.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dmg-amount">مبلغ خسارت (تومان — ۰ یعنی بدون خسارت)</Label>
            <Input
              id="dmg-amount"
              type="number"
              min={0}
              max={booking.depositTotal}
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              placeholder="۰"
            />
          </div>
          {damageNum > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="dmg-note">توضیح خسارت (الزامی)</Label>
              <Textarea
                id="dmg-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثلاً: خط و خش روی بدنهٔ دوربین"
              />
            </div>
          )}
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ودیعه</span>
              <span>{formatToman(booking.depositTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">کسر خسارت</span>
              <span className={damageNum > 0 ? 'text-rose-600' : ''}>
                − {formatToman(damageNum)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>بازگشت به اجاره‌گیرنده</span>
              <span className="text-emerald-600">{formatToman(refund)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={async () => {
              await onSubmit(note.trim(), damageNum)
              setDamage('')
              setNote('')
            }}
            disabled={busy || (damageNum > 0 && note.trim().length === 0)}
          >
            تأیید بازگشت ودیعه
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Review dialog (W12 — both parties)
// ---------------------------------------------------------------------
function ReviewDialog({
  open,
  onOpenChange,
  booking,
  onSubmit,
  busy,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  booking: BookingDTO
  onSubmit: (rating: number, comment: string) => Promise<void>
  busy: boolean
}) {
  const notify = useNav((s) => s.notify)
  const [rating, setRating] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [checking, setChecking] = React.useState(false)

  // One review per (user, listing) — check before offering the form.
  React.useEffect(() => {
    if (!open) return
    setChecking(true)
    fetch(`/api/reviews?listingId=${booking.listing.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { reviews?: { reviewer: { id: string } }[] } | null) => {
        // We don't know our own review w/o auth context here; the API
        // rejects duplicates anyway — this is just a soft check.
        void d
      })
      .finally(() => setChecking(false))
  }, [open, booking.listing.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-amber-400" /> ثبت نظر و امتیاز
          </DialogTitle>
          <DialogDescription>
            تجربهٔ همکاری در اجارهٔ «{booking.listing.title}» را ثبت کنید.
          </DialogDescription>
        </DialogHeader>
        {checking ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} ستاره`}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      'size-7 transition-colors',
                      n <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/40 hover:text-amber-300',
                    )}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="نظر شما (حداقل ۵ نویسه)…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={async () => {
              if (rating < 1 || comment.trim().length < 5) {
                notify('امتیاز و حداقل ۵ نویسه نظر لازم است.', 'error')
                return
              }
              await onSubmit(rating, comment.trim())
              setRating(0)
              setComment('')
            }}
            disabled={busy}
          >
            ثبت نظر
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  cta,
  onCta,
}: {
  icon: React.ElementType
  title: string
  desc: string
  cta: string
  onCta: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      <Button className="mt-4" onClick={onCta}>
        {cta}
      </Button>
    </div>
  )
}
