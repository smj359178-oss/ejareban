'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Brand mark: an emerald key inside a rounded tile. The key reads as
 * "rent / access" at small sizes and matches the --primary token.
 */
export function BrandMark({
  className,
  label = 'اجاره‌بان',
}: {
  className?: string
  label?: string
}) {
  const rawId = React.useId().replace(/:/g, '')
  const gradientId = `brand-${rawId}`

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="8"
          y1="4"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0f766e" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gradientId})`} />
      <g
        transform="rotate(-18 32 32)"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="21" cy="32" r="8.5" strokeWidth="6" />
        <path d="M27 32h25" strokeWidth="6" />
        <path d="M45 32v8" strokeWidth="5" />
        <path d="M52 32v6" strokeWidth="5" />
      </g>
    </svg>
  )
}
