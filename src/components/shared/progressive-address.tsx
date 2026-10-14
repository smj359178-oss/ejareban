'use client'

import * as React from 'react'
import { MapPin, Lock, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Progressive address disclosure.
 *
 * The exact address is blurred until a booking request is accepted, to
 * prevent scraping and protect privacy. Only the city and a general area
 * are shown. Once the booking is approved, the full address is revealed.
 */
export function ProgressiveAddress({
  city,
  address,
  revealed,
}: {
  city: string
  address: string | null
  revealed: boolean
}) {
  const [showHint, setShowHint] = React.useState(false)

  if (!address) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        {city}
      </span>
    )
  }

  if (revealed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <MapPin className="size-4 text-emerald-600" />
        <span className="font-medium">{city}</span>
        <span className="text-muted-foreground">·</span>
        <span>{address}</span>
      </span>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-sm">
        <MapPin className="size-4 text-muted-foreground" />
        <span className="font-medium">{city}</span>
        <span className="text-muted-foreground">·</span>
        <span className="select-none blur-sm tracking-wider text-muted-foreground">
          {address}
        </span>
        <Lock className="size-3.5 text-amber-600" />
      </span>
      <button
        onMouseEnter={() => setShowHint(true)}
        onMouseLeave={() => setShowHint(false)}
        onClick={() => setShowHint((v) => !v)}
        className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Eye className="size-3" />
        آدرس دقیق پس از تأیید رزرو نمایش داده می‌شود
      </button>
      {showHint && (
        <div className="mt-1 max-w-xs rounded-md bg-muted px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          برای حفظ حریم خصوصی مالک و جلوگیری از مراجعه بدون هماهنگی، آدرس دقیق
          فقط پس از پذیرش درخواست رزرو توسط مالک قابل مشاهده است.
        </div>
      )}
    </div>
  )
}
