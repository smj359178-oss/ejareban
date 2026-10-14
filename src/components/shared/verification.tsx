'use client'

import {
  ShieldCheck,
  Phone,
  History,
  Users,
  Lock,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toPersianDigits } from '@/lib/persian'

/**
 * Ejareban multi-tier verification system.
 *
 * Four trust levels:
 *  1. Identity (national ID + Shahkar)
 *  2. Phone (OTP)
 *  3. Rental history (number of successful bookings)
 *  4. Social proof (review rating + number of followers)
 *
 * Each verified level yields a visual badge. The overall "trust guardian"
 * tier is computed from the combined set.
 */

export interface VerificationLevels {
  identity: boolean
  phone: boolean
  rentalHistory: boolean // >= 3 completed rentals as owner
  socialProof: boolean // rating >= 4.0 && ratingCount >= 5
}

export function computeVerificationLevels(user: {
  isIdentityVerified: boolean
  isPhoneVerified: boolean
  ratingCount: number
  rating?: number
  bookingsCount?: number
}): VerificationLevels {
  return {
    identity: user.isIdentityVerified,
    phone: user.isPhoneVerified,
    rentalHistory: (user.bookingsCount ?? 0) >= 3,
    socialProof:
      user.ratingCount >= 5 && (user.rating ?? 0) >= 4.0,
  }
}

export function trustLevel(levels: VerificationLevels): number {
  return [
    levels.identity,
    levels.phone,
    levels.rentalHistory,
    levels.socialProof,
  ].filter(Boolean).length
}

const LEVELS = [
  {
    key: 'identity' as const,
    label: 'تأیید هویت',
    desc: 'کارت ملی با شاهکار',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
  },
  {
    key: 'phone' as const,
    label: 'تأیید تلفن',
    desc: 'پیامک تأیید',
    icon: Phone,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950',
    ring: 'ring-sky-200 dark:ring-sky-800',
  },
  {
    key: 'rentalHistory' as const,
    label: 'سابقه اجاره',
    desc: '۳+ رزرو موفق',
    icon: History,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950',
    ring: 'ring-amber-200 dark:ring-amber-800',
  },
  {
    key: 'socialProof' as const,
    label: 'اعتبار اجتماعی',
    desc: 'امتیاز ۴+ از ۵ نظرات',
    icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950',
    ring: 'ring-violet-200 dark:ring-violet-800',
  },
]

/** Row of verification badges — compact display in the listing card and owner profile. */
export function VerificationBadges({
  levels,
  size = 'sm',
}: {
  levels: VerificationLevels
  size?: 'sm' | 'md'
}) {
  const px = size === 'md' ? 'size-4' : 'size-3.5'
  const textPx = size === 'md' ? 'text-xs' : 'text-[10px]'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LEVELS.map((l) => {
        const ok = levels[l.key]
        return (
          <span
            key={l.key}
            title={ok ? `${l.label}: ${l.desc}` : `${l.label}: تأییدنشده`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 transition-all',
              textPx,
              ok
                ? cn(l.bg, l.color, l.ring)
                : 'bg-muted/50 text-muted-foreground/50 ring-muted',
            )}
          >
            {ok ? (
              <l.icon className={cn(px, l.color)} />
            ) : (
              <Lock className={cn(px, 'opacity-40')} />
            )}
            {l.label}
          </span>
        )
      })}
    </div>
  )
}

/** Large trust seal — shown on the listing page above the owner card. */
export function TrustSeal({
  levels,
  rating,
  ratingCount,
}: {
  levels: VerificationLevels
  rating: number
  ratingCount: number
}) {
  const lvl = trustLevel(levels)
  const tier =
    lvl >= 4
      ? { label: 'بانای طلایی', color: 'from-amber-400 to-yellow-500', text: 'text-amber-700' }
      : lvl >= 3
        ? { label: 'بانای نقره‌ای', color: 'from-slate-300 to-slate-400', text: 'text-slate-600' }
        : lvl >= 2
          ? { label: 'بانای برنزی', color: 'from-orange-300 to-amber-500', text: 'text-orange-600' }
          : { label: 'تازه‌وارد', color: 'from-zinc-200 to-zinc-300', text: 'text-zinc-500' }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-l from-primary/5 to-transparent p-3">
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg bg-gradient-to-br p-2.5 text-white shadow-sm',
          tier.color,
        )}
      >
        <ShieldCheck className="size-5" />
        <span className="mt-0.5 text-[10px] font-bold">
          {toPersianDigits(lvl)}/۴
        </span>
      </div>
      <div className="flex-1">
        <div className={cn('text-sm font-bold', tier.text)}>{tier.label}</div>
        <div className="text-xs text-muted-foreground">
          {ratingCount > 0
            ? `${toPersianDigits(rating.toFixed(1))} امتیاز از ${toPersianDigits(ratingCount)} نظر`
            : 'بدون نظر — اولین اجاره را تجربه کنید'}
        </div>
      </div>
    </div>
  )
}

/** Safety warning — shown in chat and on the listing page. */
export function SafetyWarning({
  variant = 'default',
}: {
  variant?: 'default' | 'compact'
}) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <ShieldCheck className="size-3.5 shrink-0" />
        <span>برای امنیت شما، پرداخت و ارتباط را در اجاره‌بان نگه دارید.</span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
      <ShieldCheck className="size-5 shrink-0 text-amber-600" />
      <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
        <strong>هشدار ایمنی:</strong> برای محافظت از خود، تمام ارتباطات و پرداخت‌ها را
        در پلتفرم اجاره‌بان انجام دهید. تراکنش‌های خارج از پلتفرم پوشش بیمه و
        ودیعه امن را شامل نمی‌شوند. اجاره‌بان مسئولیت خرابی یا کلاهبرداری خارج از
        پلتفرم را نمی‌پذیرد.
      </div>
    </div>
  )
}
