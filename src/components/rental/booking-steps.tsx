'use client'

import * as React from 'react'
import { CalendarDays, Truck, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toPersianDigits } from '@/lib/persian'

export type BookingStep = 1 | 2 | 3

const STEPS = [
  { n: 1, label: 'انتخاب تاریخ', icon: CalendarDays },
  { n: 2, label: 'نحوه تحویل', icon: Truck },
  { n: 3, label: 'تأیید و ارسال', icon: Check },
] as const

/** Booking progress indicator — three clear steps. */
export function BookingSteps({ current }: { current: BookingStep }) {
  return (
    <div className="flex items-start justify-between" dir="rtl">
      {STEPS.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active &&
                    'border-primary bg-primary/10 text-primary ring-4 ring-primary/15',
                  !done && !active && 'border-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : toPersianDigits(s.n)}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-1 mt-[17px] h-0.5 flex-1 rounded-full transition-colors',
                  current > s.n ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
