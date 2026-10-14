'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({
  rating,
  count,
  size = 'sm',
  showCount = true,
}: {
  rating: number
  count?: number
  size?: 'xs' | 'sm' | 'md'
  showCount?: boolean
}) {
  const px = size === 'md' ? 'size-4' : size === 'xs' ? 'size-3' : 'size-3.5'
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              px,
              i < Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground',
            )}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-foreground">
        {rating > 0 ? rating.toFixed(1) : 'New'}
      </span>
      {showCount && count != null && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </span>
  )
}
