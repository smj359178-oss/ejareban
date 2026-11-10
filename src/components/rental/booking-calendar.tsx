'use client'

import * as React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { type DateRange, type Matcher } from 'react-day-picker'
import { Loader2, ShieldCheck, Truck, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  computePrice,
  rentalDays,
  localDateKey,
} from '@/lib/availability'
import type { ListingDTO } from '@/lib/types'
import { formatToman } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { useNav } from '@/lib/store'
import { BookingSteps, type BookingStep } from '@/components/rental/booking-steps'

interface Props {
  listing: ListingDTO
}

export function BookingCalendar({ listing }: Props) {
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [blocked, setBlocked] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)
  const [delivery, setDelivery] = React.useState<'PICKUP' | 'DELIVERY'>(
    'PICKUP',
  )
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const notify = useNav((s) => s.notify)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/listings/${listing.slug}/availability`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setBlocked(new Set<string>(d.blockedDates || []))
      })
      .catch(() => {
        // A failed fetch must not look like "everything is free"; the
        // server-side conflict check remains the source of truth.
        if (alive) setBlocked(new Set())
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [listing.slug])

  const today = React.useMemo(() => {
    // B1 — LOCAL midnight: the old `startOfDateUTC(new Date())` computed
    // «امروز» on the UTC clock, which in Asia/Tehran (+03:30) lagged one
    // day for every evening hour and shifted the whole calendar.
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const disabled: Matcher[] = [
    { before: today },
    // B1 — match blocked days with the LOCAL day key (string equality);
    // the API returns plain YYYY-MM-DD strings, so no Date round-trip and
    // no timezone shift can occur anywhere in the pipeline.
    (d) => blocked.has(localDateKey(d)),
  ]

  const start = range?.from
  const end = range?.to ?? range?.from
  const days =
    start && end ? rentalDays(start, end) : 0

  const price = React.useMemo(() => {
    if (days < 1) return null
    return computePrice({
      dailyPrice: listing.dailyPrice,
      weeklyPrice: listing.weeklyPrice,
      monthlyPrice: listing.monthlyPrice,
      deposit: listing.deposit,
      deliveryFee: listing.deliveryFee,
      deliveryAvailable: listing.deliveryAvailable,
      days,
      deliveryOption: delivery,
    })
  }, [days, listing, delivery])

  const tierLabel =
    price?.pricingTier === 'MONTHLY'
      ? 'نرخ ماهانه'
      : price?.pricingTier === 'WEEKLY'
        ? 'نرخ هفتگی'
        : 'نرخ روزانه'

  async function handleBook() {
    if (!start || !end || !price) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          // B1 — send LOCAL day keys (YYYY-MM-DD of the wall-clock day the
          // user actually clicked). The server stores them as UTC midnights
          // and echoes them back verbatim, so calendar → booking → display
          // all agree on the same day.
          startDate: localDateKey(start),
          endDate: localDateKey(end),
          deliveryOption: delivery,
          message: message || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // Specific Persian messages per status (bug 10-UI), falling back to
        // the server's own Persian `error` string.
        if (res.status === 401) {
          setError('برای رزرو باید وارد شوید.')
        } else if (res.status === 429) {
          setError(
            data?.error ??
              'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.',
          )
        } else {
          setError(data?.error ?? 'رزرو ناموفق بود. لطفاً دوباره تلاش کنید.')
        }
        return
      }
      notify('درخواست رزرو ارسال شد! مالک به‌زودی پاسخ می‌دهد.', 'success')
      setRange(undefined)
      setMessage('')
      useNav.getState().go({ name: 'dashboard', tab: 'bookings' })
    } catch {
      // fetch() itself threw (offline / network failure)
      setError('اتصال به سرور ناموفق بود')
    } finally {
      setSubmitting(false)
    }
  }

  const tooShort = !!(start && end && days < listing.minRentalDays)
  const tooLong =
    listing.maxRentalDays != null && !!start && !!end && days > listing.maxRentalDays

  return (
    <div className="flex flex-col gap-5">
      {/* نشانگر پیشرفت رزرو */}
      <BookingSteps
        current={
          !start ? 1 : !price ? 2 : 3
        }
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            انتخاب تاریخ اجاره
          </h3>
          <p className="text-sm text-muted-foreground">
            تاریخ شروع و پایان را انتخاب کنید. روزهای رزروشده غیرفعال هستند.
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="size-3.5" />
            {toPersianDigits(blocked.size)} روز رزروشده
          </Badge>
        )}
      </div>

      <div className="flex justify-center rounded-xl border bg-card p-2">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={1}
          disabled={disabled}
          // B5 — without excludeDisabled, react-day-picker lets a range span
          // blocked (disabled) days; those nights were then rejected only on
          // the server, after the user believed the selection was valid.
          excludeDisabled
          showOutsideDays
          className="mx-auto"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          تحویل
        </Label>
        <RadioGroup
          value={delivery}
          onValueChange={(v) => setDelivery(v as 'PICKUP' | 'DELIVERY')}
          className="grid grid-cols-2 gap-2"
        >
          <DeliveryOption
            value="PICKUP"
            title="مراجعه حضوری"
            desc="دریافت از مالک"
            icon={<CalendarDays className="size-4" />}
            active={delivery === 'PICKUP'}
          />
          <DeliveryOption
            value="DELIVERY"
            title="ارسال"
            desc={
              listing.deliveryAvailable
                ? `+ ${formatToman(listing.deliveryFee)}`
                : 'غیرفعال'
            }
            icon={<Truck className="size-4" />}
            disabled={!listing.deliveryAvailable}
            active={delivery === 'DELIVERY'}
          />
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="msg"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          پیام به مالک (اختیاری)
        </Label>
        <Textarea
          id="msg"
          placeholder="به مالک بگویید وسیله را برای چه کاری می‌خواهید یا سوال بپرسید."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      {price && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {tierLabel} · {formatToman(price.dailyRate)}/روز × {toPersianDigits(days)}
            </span>
            <span className="font-medium">{formatToman(price.rentalPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">کارمزد سرویس (۷٪)</span>
            <span className="font-medium">{formatToman(price.serviceFee)}</span>
          </div>
          {price.deliveryFee > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ارسال</span>
              <span className="font-medium">
                {formatToman(price.deliveryFee)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ودیعه امن (قابل بازگشت)
            </span>
            <span className="font-medium">{formatToman(price.depositTotal)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">مجموع قابل پرداخت</span>
            <span className="text-xl font-bold tracking-tight">
              {formatToman(price.totalAmount)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ودیعه به‌صورت امن نگهداری شده و با بازگشت وسیله سالم، بازپرداخت می‌شود.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={!price || submitting || tooShort || tooLong}
        onClick={handleBook}
      >
        {submitting
          ? 'در حال ارسال درخواست…'
          : price
            ? `درخواست رزرو · ${formatToman(price.totalAmount)}`
            : 'برای رزرو تاریخ انتخاب کنید'}
      </Button>
      {tooShort && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          حداقل دوره اجاره {toPersianDigits(listing.minRentalDays)} روز است.
        </p>
      )}
      {tooLong && listing.maxRentalDays != null && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          حداکثر دوره اجاره {toPersianDigits(listing.maxRentalDays)} روز است.
        </p>
      )}
    </div>
  )
}

function DeliveryOption({
  value,
  title,
  desc,
  icon,
  active,
  disabled,
}: {
  value: string
  title: string
  desc: string
  icon: React.ReactNode
  active: boolean
  disabled?: boolean
}) {
  return (
    <Label
      htmlFor={`opt-${value}`}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <RadioGroupItem value={value} id={`opt-${value}`} disabled={disabled} />
      <div className="flex size-8 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Label>
  )
}
