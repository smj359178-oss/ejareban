'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  MapPin,
  ShieldCheck,
  ShieldOff,
  Truck,
  Star,
  ChevronLeft,
  Share2,
  Heart,
  Flag,
  Lock,
  CalendarClock,
  Package,
  BadgeCheck,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { BookingCalendar } from '@/components/rental/booking-calendar'
import { StarRating } from '@/components/shared/star-rating'
import {
  VerifiedBadge,
  TrustScore,
  JoinedPill,
} from '@/components/shared/badges'
import {
  VerificationBadges,
  TrustSeal,
  SafetyWarning,
  computeVerificationLevels,
} from '@/components/shared/verification'
import { ProgressiveAddress } from '@/components/shared/progressive-address'
import { useNav } from '@/lib/store'
import { useChatStore } from '@/lib/chat-store'
import { useSession } from '@/hooks/use-session'
import { useFetch } from '@/hooks/use-fetch'
import type { ConversationDTO, ListingDTO, ReviewDTO } from '@/lib/types'
import { CONDITION_LABELS, REPORT_REASONS_FA } from '@/lib/constants'
import { formatToman, formatTomanCompact, timeAgo } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { cn } from '@/lib/utils'

export function ListingView({ slug }: { slug: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const notify = useNav((s) => s.notify)
  const openConversation = useChatStore((s) => s.openConversation)
  const { user } = useSession()
  const [activeImg, setActiveImg] = React.useState(0)
  const [fav, setFav] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [chatStarting, setChatStarting] = React.useState(false)

  const { data, loading } = useFetch<{ listing: ListingDTO }>(
    `/api/listings/${slug}`,
    [slug],
  )
  const listing = data?.listing
  const { data: revData } = useFetch<{ reviews: ReviewDTO[] }>(
    listing ? `/api/reviews?listingId=${listing.id}` : null,
    [listing?.id],
  )
  const reviews = revData?.reviews ?? []

  // B2 — the heart used to ALWAYS render empty because `fav` was never
  // hydrated from the server. Fetch the user's favorite ids once and set
  // the initial state from the database.
  React.useEffect(() => {
    if (!user || !listing) return
    let alive = true
    fetch('/api/favorites', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { favorites?: string[] } | null) => {
        if (!alive || !d || !Array.isArray(d.favorites)) return
        setFav(d.favorites.includes(listing.id))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user, listing?.id])

  React.useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  // Create-or-find a 1-to-1 conversation with this listing's owner, then
  // open the chat panel. Disabled when the viewer IS the owner.
  async function startConversation() {
    if (!listing || !user) return
    if (listing.owner.id === user.id) {
      notify('این آگهی متعلق به خود شماست.', 'info')
      return
    }
    setChatStarting(true)
    try {
      const r = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          otherUserId: listing.owner.id,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      openConversation(d.conversation as ConversationDTO)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطا'
      notify(`خطا در شروع گفتگو: ${msg}`, 'error')
    } finally {
      setChatStarting(false)
    }
  }

  if (loading) return <ListingSkeleton />
  if (!listing)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">آگهی پیدا نشد</h1>
        <Button className="mt-4" onClick={() => go({ name: 'browse' })}>
          مشاهده آگهی‌ها
        </Button>
      </div>
    )

  // Viewer is the listing's owner (bug 19). For guests the API masks the
  // owner id to '' so this is always false without a session.
  const isOwner = !!user && user.id === listing.owner.id

  const tiers = [
    { label: 'روزانه', value: listing.dailyPrice, suffix: '/روز' },
    listing.weeklyPrice != null && {
      label: 'هفتگی',
      value: listing.weeklyPrice,
      suffix: '/هفته',
    },
    listing.monthlyPrice != null && {
      label: 'ماهانه',
      value: listing.monthlyPrice,
      suffix: '/ماه',
    },
  ].filter(Boolean) as { label: string; value: number; suffix: string }[]

  const weeklyDiscount =
    listing.weeklyPrice != null
      ? Math.round((1 - listing.weeklyPrice / (listing.dailyPrice * 7)) * 100)
      : 0

  async function toggleFav() {
    // Bug 14: guests get a login prompt instead of a silent API failure.
    if (!user) {
      notify('برای ذخیرهٔ آگهی ابتدا وارد شوید.', 'info')
      return
    }
    if (fav) {
      await fetch(`/api/favorites?listingId=${listing!.id}`, { method: 'DELETE' })
      setFav(false)
      notify('از علاقه‌مندی حذف شد', 'info')
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing!.id }),
      })
      setFav(true)
      notify('به علاقه‌مندی اضافه شد', 'success')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      {/* Breadcrumb / back */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={back}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl-flip" /> بازگشت
        </button>
        <div className="flex items-center gap-1">
          {!isOwner && (
            <Button variant="ghost" size="sm" onClick={toggleFav}>
              <Heart className={cn('size-4', fav && 'fill-rose-500 text-rose-500')} />
              {fav ? 'ذخیره‌شده' : 'ذخیره'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href)
              notify('لینک کپی شد', 'success')
            }}
          >
            <Share2 className="size-4" /> اشتراک‌گذاری
          </Button>
          {user && (
            <Dialog
              open={reportOpen}
              onOpenChange={(o) => {
                // Bug 14: guests must never reach the report form.
                if (o && !user) {
                  notify('برای گزارش آگهی ابتدا وارد شوید.', 'info')
                  return
                }
                setReportOpen(o)
              }}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Flag className="size-4" /> گزارش
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>گزارش این آگهی</DialogTitle>
                </DialogHeader>
                <ReportForm
                  onClose={() => setReportOpen(false)}
                  listingId={listing.id}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* JSON-LD for this rental listing (SEO) */}
      <RentalJsonLd listing={listing} />

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left: gallery + details */}
        <div className="flex flex-col gap-6">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border bg-muted">
              {listing.images[activeImg] && (
                <Image
                  src={listing.images[activeImg]}
                  alt={listing.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
              )}
              {listing.featured && (
                <Badge className="absolute right-3 top-3 bg-amber-500 text-white">
                  ویژه
                </Badge>
              )}
            </div>
            {listing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      'relative size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      activeImg === i ? 'border-primary' : 'border-transparent',
                    )}
                  >
                    <Image
                      src={img}
                      alt={`${listing.title} ${toPersianDigits(i + 1)}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {listing.category && (
                <Badge variant="secondary">{listing.category.name}</Badge>
              )}
              <Badge variant="outline">
                {CONDITION_LABELS[listing.condition]}
              </Badge>
              {listing.brand && (
                <Badge variant="outline">
                  {listing.brand}
                  {listing.model ? ` · ${listing.model}` : ''}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {listing.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {/* Bug 13: for guests the backend nulls the address — render
                  a simple city line instead of the address element. */}
              {listing.address ? (
                <ProgressiveAddress
                  city={listing.city}
                  address={listing.address}
                  revealed={isOwner || user?.role === 'ADMIN'}
                />
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {listing.city}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarClock className="size-4" /> حداقل{' '}
                {toPersianDigits(listing.minRentalDays)} روز
                {listing.maxRentalDays
                  ? ` · حداکثر ${toPersianDigits(listing.maxRentalDays)}`
                  : ''}
              </span>
              <StarRating rating={listing.rating} count={listing.ratingCount} />
              <span>{toPersianDigits(listing.views)} بازدید</span>
            </div>
          </div>

          {/* Pricing tiers */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Package className="size-4 text-primary" /> نرخ‌های اجاره
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {tiers.map((t, i) => (
                  <div
                    key={t.label}
                    className={cn(
                      'rounded-xl border p-3 text-center',
                      i === 0 && 'ring-1 ring-primary',
                    )}
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t.label}
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {formatTomanCompact(t.value)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.suffix}
                    </div>
                    {i === 1 && weeklyDiscount > 0 && (
                      <Badge className="mt-1 bg-emerald-600 text-white">
                        {toPersianDigits(weeklyDiscount)}٪ تخفیف
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  ودیعه: {formatToman(listing.deposit)} (قابل بازگشت)
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck className="size-4" />
                  {listing.deliveryAvailable
                    ? `ارسال · ${formatToman(listing.deliveryFee)}`
                    : 'فقط مراجعه حضوری'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <div>
            <h2 className="mb-2 text-lg font-semibold">درباره این کالا</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          </div>

          {/* Owner card — guests get a locked-identity CTA (bug 13) */}
          {!user ? (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                    <ShieldOff className="size-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      اطلاعات مالک برای مهمان‌ها پنهان است
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      برای مشاهدهٔ مالک، گفتگو و رزرو، وارد حساب خود شوید.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/login">ورود به حساب</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarImage src={listing.owner.avatar || undefined} />
                  <AvatarFallback>
                    {(listing.owner.name ?? '؟')[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {listing.owner.name ?? 'مالک'}
                    </h3>
                    {listing.owner.isIdentityVerified && (
                      <VerifiedBadge label="تأییدشده" />
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <TrustScore score={listing.owner.trustScore} />
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {listing.owner.rating > 0
                        ? `${toPersianDigits(listing.owner.rating.toFixed(1))} (${toPersianDigits(listing.owner.ratingCount)})`
                        : 'مالک جدید'}
                    </span>
                    <JoinedPill iso={listing.owner.createdAt} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startConversation}
                  disabled={chatStarting || isOwner}
                >
                  {chatStarting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )}{' '}
                  پیام
                </Button>
              </div>
              {/* مهر اعتماد چندسطحی */}
              <div className="mt-4 space-y-3">
                <TrustSeal
                  levels={computeVerificationLevels({
                    isIdentityVerified: listing.owner.isIdentityVerified,
                    isPhoneVerified: true,
                    ratingCount: listing.owner.ratingCount,
                    rating: listing.owner.rating,
                    bookingsCount: listing.bookingsCount,
                  })}
                  rating={listing.owner.rating}
                  ratingCount={listing.owner.ratingCount}
                />
                <VerificationBadges
                  levels={computeVerificationLevels({
                    isIdentityVerified: listing.owner.isIdentityVerified,
                    isPhoneVerified: true,
                    ratingCount: listing.owner.ratingCount,
                    rating: listing.owner.rating,
                    bookingsCount: listing.bookingsCount,
                  })}
                  size="sm"
                />
              </div>
            </CardContent>
          </Card>
          )}

          {/* هشدار ایمنی */}
          <SafetyWarning />

          {/* Reviews */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                نظرات ({toPersianDigits(reviews.length)})
              </h2>
              {listing.ratingCount > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="size-5 fill-amber-400 text-amber-400" />
                  <span className="text-lg font-bold">
                    {toPersianDigits(listing.rating.toFixed(1))}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    · {toPersianDigits(listing.ratingCount)} نظر
                  </span>
                </div>
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                هنوز نظری ثبت نشده — نظرات فقط توسط اجاره‌گیرندگان واقعی
                ثبت می‌شود.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={r.reviewer.avatar || undefined} />
                          <AvatarFallback>
                            {(r.reviewer.name ?? '؟')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {r.reviewer.name ?? 'کاربر'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(r.createdAt)}
                            </span>
                          </div>
                          <StarRating
                            rating={r.rating}
                            showCount={false}
                            size="xs"
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {r.comment}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: sticky booking card */}
        <aside className="lg:relative">
          <div className="lg:sticky lg:top-28">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold">
                      {formatToman(listing.dailyPrice)}
                    </span>
                    <span className="text-sm text-muted-foreground"> /روز</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">
                      {listing.rating > 0 ? toPersianDigits(listing.rating.toFixed(1)) : 'جدید'}
                    </span>
                  </div>
                </div>
                {!user ? (
                  /* Bug 13: guests cannot pick dates — login CTA instead. */
                  <div className="rounded-2xl border border-dashed p-5 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                      <CalendarClock className="size-6" />
                    </div>
                    <h3 className="mt-3 font-semibold">
                      انتخاب تاریخ برای مهمان‌ها فعال نیست
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      برای انتخاب تاریخ و ثبت درخواست رزرو وارد شوید.
                    </p>
                    <Button asChild size="sm" className="mt-4 w-full">
                      <Link href="/login">
                        <Lock className="size-4" /> ورود به حساب
                      </Link>
                    </Button>
                  </div>
                ) : isOwner ? (
                  /* Bug 19: owners cannot rent their own item — management panel. */
                  <div className="rounded-2xl border bg-muted/40 p-5 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Package className="size-6" />
                    </div>
                    <h3 className="mt-3 font-semibold">
                      این آگهی متعلق به شماست
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      به‌عنوان مالک نمی‌توانید کالای خودتان را اجاره بگیرید.
                    </p>
                    <div className="mt-4 grid gap-2">
                      <Button
                        size="sm"
                        onClick={() => go({ name: 'dashboard', tab: 'listings' })}
                      >
                        مدیریت آگهی‌ها
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => go({ name: 'new-listing' })}
                      >
                        آگهی جدید
                      </Button>
                    </div>
                  </div>
                ) : (
                  <BookingCalendar listing={listing} />
                )}
              </CardContent>
            </Card>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              هنوز مبلغی کسر نمی‌شود — ابتدا مالک تأیید می‌کند.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ReportForm({
  listingId,
  onClose,
}: {
  listingId: string
  onClose: () => void
}) {
  const [reason, setReason] = React.useState('spam')
  const [desc, setDesc] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const notify = useNav((s) => s.notify)
  const reasons = ['spam', 'scam', 'inappropriate', 'duplicate', 'other']

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          reason,
          description: desc.trim() || undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        notify('گزارش شما ثبت شد. تیم پشتیبانی بررسی می‌کند.', 'success')
        onClose()
      } else {
        notify(d.error ?? 'ثبت گزارش ناموفق بود', 'error')
      }
    } catch {
      notify('ثبت گزارش ناموفق بود', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {reasons.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm capitalize',
              reason === r
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted',
            )}
          >
            {REPORT_REASONS_FA[r]}
          </button>
        ))}
      </div>
      <Textarea
        placeholder="جزئیات (اختیاری)…"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={3}
      />
      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? 'در حال ارسال…' : 'ثبت گزارش'}
      </Button>
    </div>
  )
}

function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-3">
            <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  )
}

function RentalJsonLd({ listing }: { listing: ListingDTO }) {
  const SITE_URL = 'https://ejareban.app'
  const json = {
    '@context': 'https://schema.org',
    // RentalListing is not a valid schema.org type — Product + Offer is the
    // Google-recommended shape for rentable goods.
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    category: listing.category?.name,
    brand: listing.brand
      ? { '@type': 'Brand', name: listing.brand }
      : undefined,
    model: listing.model,
    image: listing.images.map((src) =>
      src.startsWith('http') ? src : `${SITE_URL}${src}`,
    ),
    areaServed: { '@type': 'Place', name: listing.city },
    url: `${SITE_URL}/?listing=${listing.slug}`,
    aggregateRating:
      listing.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: listing.rating,
            reviewCount: listing.ratingCount,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      // IRT is not ISO 4217; IRR is the closest valid currency code.
      price: listing.dailyPrice,
      priceCurrency: 'IRR',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/?listing=${listing.slug}`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: listing.dailyPrice,
        priceCurrency: 'IRR',
        unitCode: 'DAY',
        billingIncrement: listing.minRentalDays,
      },
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
