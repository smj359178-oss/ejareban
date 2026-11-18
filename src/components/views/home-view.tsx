'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Search,
  ShieldCheck,
  CalendarCheck,
  HandCoins,
  ArrowLeft,
  Sparkles,
  MapPin,
  Star,
  TrendingUp,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CategoryIcon } from '@/components/shared/category-icon'
import { ListingCard, ListingCardSkeleton } from '@/components/rental/listing-card'
import { useNav } from '@/lib/store'
import { useFetch } from '@/hooks/use-fetch'
import type { CategoryDTO, ListingDTO } from '@/lib/types'
import { formatTomanCompact } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Search,
    title: '۱. جستجو',
    desc: 'در میان آیتم‌های قابل اجاره در سراسر ایران بگردید. فیلتر بر اساس دسته، شهر، قیمت و موجودی.',
  },
  {
    icon: CalendarCheck,
    title: '۲. رزرو تاریخ‌ها',
    desc: 'بازه اجاره را در تقویم موجودی زنده انتخاب کنید. روزانه، هفتگی یا ماهانه — با تخفیف خودکار.',
  },
  {
    icon: HandCoins,
    title: '۳. پرداخت امن',
    desc: 'مبلغ اجاره + ودیعه قابل بازگشت به‌صورت امن نگهداری می‌شود. مالک تأیید می‌کند، شما تحویل می‌گیرید.',
  },
  {
    icon: ShieldCheck,
    title: '۴. اجاره و بازگشت',
    desc: 'از وسیله استفاده کنید، سپس بازگردانید. ودیعه پس از تأیید وضعیت توسط مالک، بازپرداخت می‌شود.',
  },
]

interface PlatformStats {
  totalListings: number
  activeListings: number
  totalUsers: number
  completedRentals: number
  totalReviews: number
  averageRating: number
  ratedListings: number
}

export function HomeView() {
  const go = useNav((s) => s.go)
  const [q, setQ] = React.useState('')

  const { data: catData } = useFetch<{ categories: CategoryDTO[] }>(
    '/api/categories',
  )
  const { data: featData, loading: featLoading } = useFetch<{
    listings: ListingDTO[]
  }>('/api/listings?featured=true&limit=8')
  const { data: cheapData } = useFetch<{ listings: ListingDTO[] }>(
    '/api/listings?sort=price_asc&limit=4',
  )
  // B3 — REAL platform stats from the database (was: hard-coded fake numbers
  // like «۱۲هزار+ آیتم» / «۳۸هزار+ کاربر»). Renders the live counts and
  // falls back to a neutral skeleton while loading.
  const { data: statsData } = useFetch<{ stats: PlatformStats }>('/api/stats')
  const stats = statsData?.stats

  const featured = featData?.listings ?? []
  const cheap = cheapData?.listings ?? []
  const categories = catData?.categories ?? []

  function search(e: React.FormEvent) {
    e.preventDefault()
    go({ name: 'browse', query: q })
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        {/* تصویر هیرو تولیدشده + گرادینت روی آن */}
        <div className="absolute inset-0">
          <Image
            src="/hero/hero-main.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-background via-background/90 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="mb-3 w-fit gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
              <Sparkles className="size-3.5 text-primary" />
              همراه اجارهٔ شما · امن، سریع، قابل اعتماد
            </Badge>
            <h1 className="max-w-xl text-balance text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              اجاره امن،
              <br />
              <span className="bg-gradient-to-l from-primary to-emerald-600 bg-clip-text text-transparent">
                هر چیزی، هر کجا.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-balance text-base text-muted-foreground sm:text-lg text-pretty-fa">
              لپ‌تاپ، دوربین، ابزار، تجهیزات رویداد و بیشتر — روزانه، هفتگی یا
              ماهانه. مالکان با تأیید هویت چندسطحی، ودیعه امن بیمه‌شده و تقویم
              رزرو زنده.
            </p>
            <form onSubmit={search} className="mt-6 flex max-w-lg flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="چه چیزی می‌خواهید اجاره کنید؟"
                  className="h-12 rounded-xl border-transparent bg-background/80 pr-10 shadow-lg backdrop-blur focus-visible:bg-background"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full rounded-xl px-6 shadow-lg sm:w-auto">
                جستجو
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>صاحب وسیله‌ای هستید؟</span>
              <button
                onClick={() => go({ name: 'new-listing' })}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                آگهی خود را ثبت کنید
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> ودیعه بیمه‌شده
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarCheck className="size-4 text-primary" /> موجودی زنده
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-violet-600 dark:text-violet-400" /> تأیید هویت ۴سطحی
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="size-4 fill-amber-400 text-amber-400" /> نظرات واقعی
              </span>
            </div>
          </div>

          {/* Floating featured cards */}
          <div className="relative hidden lg:block">
            {/* چهار کارت یکنواخت: هم‌اندازه، هم‌فرمت و هم‌تراز در شبکهٔ ۲×۲ */}
            <div className="absolute left-0 top-0 grid w-[28rem] grid-cols-2 gap-4">
              {featured.slice(0, 4).map((l) => (
                <button
                  key={l.id}
                  onClick={() => go({ name: 'listing', slug: l.slug })}
                  className="group overflow-hidden rounded-2xl border bg-card text-right shadow-sm ring-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2"
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {l.images[0] && (
                      <Image
                        src={l.images[0]}
                        alt={l.title}
                        fill
                        sizes="300px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                    <Badge className="absolute right-2 top-2 bg-primary text-primary-foreground">
                      {formatTomanCompact(l.dailyPrice)}/ روز
                    </Badge>
                  </div>
                  <div className="p-2.5">
                    <div className="line-clamp-1 text-xs font-semibold text-pretty-fa">
                      {l.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="size-2.5" />
                      {l.city}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              مرور بر اساس دسته
            </h2>
            <p className="text-sm text-muted-foreground">
              از تجهیزات حرفه‌ای تا ملزومات مراسم.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go({ name: 'browse' })}
            className="shrink-0 gap-1"
          >
            مشاهده همه <ArrowLeft className="size-4 rtl-flip" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => go({ name: 'browse', categorySlug: c.slug })}
              className="group relative flex min-h-[8.5rem] flex-col items-start overflow-hidden rounded-2xl border bg-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div
                className={cn(
                  'mb-3 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                  c.color || 'from-primary to-primary/70',
                )}
              >
                <CategoryIcon name={c.icon} className="size-6" />
              </div>
              <div className="text-sm font-semibold text-pretty-fa">{c.name}</div>
              <div className="mt-auto pt-1 text-xs text-muted-foreground">
                {toPersianDigits(c.listingCount)} آیتم
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured rentals */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <TrendingUp className="size-6 text-primary" />
              آگهی‌های ویژه
            </h2>
            <p className="text-sm text-muted-foreground">
              انتخاب‌های دست‌چین‌شده از مالکان تأییدشده با بالاترین امتیاز.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go({ name: 'browse' })}
            className="shrink-0 gap-1"
          >
            مشاهده همه <ArrowLeft className="size-4 rtl-flip" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))
            : featured.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="mb-8 text-center">
            <Badge variant="secondary" className="mb-3">
              اجاره‌بان چگونه کار می‌کند
            </Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight">
              اجاره در چهار گام ساده
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.title} className="relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <h3 className="font-semibold text-pretty-fa">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty-fa">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Budget picks */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">پیشنهاد اقتصادی</h2>
            <p className="text-sm text-muted-foreground">
              تجهیزات خوب با قیمت روزانه پایین‌تر.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cheap.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Trust / verification band */}
      <section className="border-t bg-gradient-to-br from-primary/5 via-background to-emerald-500/5">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge className="mb-3 gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                <ShieldCheck className="size-3.5" /> اعتماد و امنیت
              </Badge>
              <h2 className="text-balance text-2xl font-bold tracking-tight text-pretty-fa sm:text-3xl">
                مالکان تأییدشده. ودیعه امن. نظرات واقعی.
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty-fa">
                هر مالک از طریق تأیید هویت (کارت ملی با شاهکار) احراز می‌شود. هر
                رزرو با ودیعه قابل بازگشت که نزد اجاره‌بان نگهداری می‌شود، پشتیبانی
                می‌گردد. نظرات فقط برای اجاره‌های تکمیل‌شده ثبت می‌شوند — بدون
                امتیازدهی جعلی.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => go({ name: 'browse' })}>
                  شروع اجاره <ArrowLeft className="size-4 rtl-flip" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => go({ name: 'new-listing' })}
                >
                  ثبت آگهی
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(stats
                ? [
                    { value: toPersianDigits(stats.activeListings), label: 'آگهی فعال' },
                    { value: toPersianDigits(stats.totalUsers), label: 'کاربر عضو' },
                    {
                      value: stats.averageRating > 0
                        ? `${toPersianDigits(stats.averageRating.toFixed(1))}★`
                        : '—',
                      label: 'میانگین امتیاز',
                    },
                    { value: toPersianDigits(stats.completedRentals), label: 'اجارهٔ تکمیل‌شده' },
                  ]
                : Array.from({ length: 4 }, (_, i) => ({
                    value: '…',
                    label: ['آگهی فعال', 'کاربر عضو', 'میانگین امتیاز', 'اجارهٔ تکمیل‌شده'][i],
                  }))
              ).map((s) => (
                <Card key={s.label} className="text-center">
                  <CardContent className="p-5 sm:p-6">
                    <div className="text-2xl font-black tracking-tight text-primary sm:text-3xl">
                      {s.value}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {s.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
