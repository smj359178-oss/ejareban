'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Heart,
  MapPin,
  ShieldCheck,
  Star,
  BadgeCheck,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CONDITION_LABELS, type ListingDTO } from '@/lib/types'
import { formatToman, formatTomanCompact } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { useNav } from '@/lib/store'
import { useSession } from '@/hooks/use-session'

export function ListingCard({ listing }: { listing: ListingDTO }) {
  const go = useNav((s) => s.go)
  const notify = useNav((s) => s.notify)
  const { user } = useSession()
  const [fav, setFav] = React.useState(false)
  const [favLoading, setFavLoading] = React.useState(false)

  async function toggleFav(e: React.MouseEvent) {
    e.stopPropagation()
    // Bug 14: guests get a login prompt instead of a silent 401.
    if (!user) {
      notify('برای ذخیرهٔ آگهی ابتدا وارد شوید.', 'info')
      return
    }
    setFavLoading(true)
    try {
      if (fav) {
        await fetch(`/api/favorites?listingId=${listing.id}`, { method: 'DELETE' })
        setFav(false)
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id }),
        })
        setFav(true)
        notify('به علاقه‌مندی‌ها اضافه شد', 'success')
      }
    } finally {
      setFavLoading(false)
    }
  }

  const cover = listing.images[0]
  const discount =
    listing.weeklyPrice != null
      ? Math.round(
          (1 - listing.weeklyPrice / (listing.dailyPrice * 7)) * 100,
        )
      : 0

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onClick={() => go({ name: 'listing', slug: listing.slug })}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-premium"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            بدون تصویر
          </div>
        )}

        {/* Gradient overlay for badge readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Badges */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {listing.featured && (
            <Badge className="border-0 bg-amber-500/95 text-white shadow-md backdrop-blur hover:bg-amber-500">
              <TrendingUp className="me-1 size-3" /> ویژه
            </Badge>
          )}
          {discount > 0 && (
            <Badge className="border-0 bg-emerald-600/95 text-white shadow-md backdrop-blur hover:bg-emerald-600">
              {toPersianDigits(discount)}٪ تخفیف هفته
            </Badge>
          )}
        </div>

        {/* Favorite */}
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleFav}
          disabled={favLoading}
          aria-label={fav ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
          className={cn(
            'absolute left-2 top-2 size-9 rounded-full border-0 bg-white/90 shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-white',
            fav && 'text-rose-500',
          )}
        >
          <Heart className={cn('size-4 transition-all', fav && 'fill-current scale-110')} />
        </Button>

        {/* Owner verified badge on image */}
        {listing.owner.isIdentityVerified && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-emerald-950/80 dark:text-emerald-300 dark:ring-emerald-800/60">
            <BadgeCheck className="size-3" />
            مالک تأییدشده
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
          {listing.title}
        </h3>

        {/* Location + condition */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 text-primary/60" />
          {listing.city}
          <span className="text-muted-foreground/40">·</span>
          <span>{CONDITION_LABELS[listing.condition]}</span>
        </div>

        {/* Price section */}
        <div className="mt-auto pt-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tracking-tight text-foreground">
                  {formatTomanCompact(listing.dailyPrice)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  /روز
                </span>
              </div>
              {listing.weeklyPrice != null && (
                <div className="text-[11px] text-muted-foreground line-through decoration-rose-400/60">
                  {formatTomanCompact(listing.dailyPrice * 7)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 dark:bg-amber-950/40">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {listing.rating > 0 ? toPersianDigits(listing.rating.toFixed(1)) : 'جدید'}
              </span>
            </div>
          </div>

          {/* Deposit + weekly price bar */}
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
              ودیعه {formatTomanCompact(listing.deposit)}
            </span>
            {listing.weeklyPrice != null && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {formatTomanCompact(listing.weeklyPrice)}/هفته
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="aspect-[4/3] w-full shimmer" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
