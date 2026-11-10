'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BOOKING_STATUS_META, type BookingStatus } from '@/lib/types'

const TONE: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
  blue: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800',
  emerald:
    'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  slate:
    'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  rose: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const meta = BOOKING_STATUS_META[status] || {
    label: status,
    tone: 'zinc',
  }
  return (
    <Badge
      className={cn(
        'ring-1 hover:opacity-90',
        TONE[meta.tone] || TONE.zinc,
      )}
    >
      {meta.label}
    </Badge>
  )
}
