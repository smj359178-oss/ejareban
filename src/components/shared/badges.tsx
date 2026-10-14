'use client'

import { ShieldCheck, BadgeCheck, Star, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toPersianDigits, joinedYearFa } from '@/lib/persian'

export function VerifiedBadge({
  label = 'تأییدشده',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
        className,
      )}
    >
      <ShieldCheck className="size-3" />
      {label}
    </span>
  )
}

export function TrustScore({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800'
      : score >= 50
        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800'
        : 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        tone,
      )}
      title={`امتیاز اعتماد: ${toPersianDigits(score)}/۱۰۰`}
    >
      <Star className="size-3 fill-current" />
      {toPersianDigits(score)}
    </span>
  )
}

export function JoinedPill({ iso }: { iso: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Clock className="size-3" />
      عضو از {joinedYearFa(iso)}
    </span>
  )
}

export function OwnerCheck({ className }: { className?: string }) {
  return <BadgeCheck className={cn('size-4 text-sky-500', className)} />
}
