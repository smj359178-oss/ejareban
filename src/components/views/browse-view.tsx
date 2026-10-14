'use client'

import * as React from 'react'
import {
  SlidersHorizontal,
  X,
  Search,
  MapPin,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ListingCard, ListingCardSkeleton } from '@/components/rental/listing-card'
import { useNav } from '@/lib/store'
import { useFetch } from '@/hooks/use-fetch'
import { CITIES } from '@/lib/constants'
import { toPersianDigits } from '@/lib/persian'
import type { CategoryDTO, ListingDTO } from '@/lib/types'

const SORTS = [
  { value: 'featured', label: 'ویژه' },
  { value: 'price_asc', label: 'قیمت: کم به زیاد' },
  { value: 'price_desc', label: 'قیمت: زیاد به کم' },
  { value: 'rating', label: 'بالاترین امتیاز' },
  { value: 'newest', label: 'جدیدترین' },
]

const PRICE_PRESETS = [0, 200000, 500000, 1000000, 2000000]

// W11 — build the page-button list for the browse pagination: a window of up
// to 5 page numbers centered on the current page, with the first/last page
// kept reachable and 'ellipsis' sentinels marking skipped ranges.
function buildPageItems(
  current: number,
  pages: number,
): Array<number | 'ellipsis'> {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
  let start = Math.max(1, current - 2)
  const end = Math.min(pages, start + 4)
  start = Math.max(1, end - 4)
  const items: Array<number | 'ellipsis'> = []
  if (start > 1) {
    items.push(1)
    if (start > 2) items.push('ellipsis')
  }
  for (let i = start; i <= end; i++) items.push(i)
  if (end < pages) {
    if (end < pages - 1) items.push('ellipsis')
    items.push(pages)
  }
  return items
}

export function BrowseView() {
  const view = useNav((s) => s.view)
  const go = useNav((s) => s.go)

  const initialCategory =
    view.name === 'browse' ? view.categorySlug ?? 'all' : 'all'
  const initialQuery = view.name === 'browse' ? view.query ?? '' : ''

  const [category, setCategory] = React.useState(initialCategory)
  const [city, setCity] = React.useState('all')
  const [query, setQuery] = React.useState(initialQuery)
  const [minPrice, setMinPrice] = React.useState<number | ''>('')
  const [maxPrice, setMaxPrice] = React.useState<number | ''>('')
  const [sort, setSort] = React.useState('featured')
  const [page, setPage] = React.useState(1)
  const [mobileFilters, setMobileFilters] = React.useState(false)

  // W11 — wrap any filter change so pagination resets to the first page.
  function applyFilter(change: () => void) {
    setPage(1)
    change()
  }

  React.useEffect(() => {
    if (view.name === 'browse') {
      setCategory(view.categorySlug ?? 'all')
      setQuery(view.query ?? '')
      setPage(1)
    }
  }, [view])

  // W11 — smooth-scroll back to the top whenever the page changes
  // (skipped on initial mount so a fresh load doesn't jump).
  const didMount = React.useRef(false)
  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const { data: catData } = useFetch<{ categories: CategoryDTO[] }>(
    '/api/categories',
  )
  const categories = catData?.categories ?? []

  const params = new URLSearchParams()
  if (category && category !== 'all') params.set('category', category)
  if (city && city !== 'all') params.set('city', city)
  if (query) params.set('q', query)
  if (minPrice !== '') params.set('minPrice', String(minPrice))
  if (maxPrice !== '') params.set('maxPrice', String(maxPrice))
  params.set('sort', sort)
  params.set('limit', '24')
  params.set('page', String(page))

  const { data, loading } = useFetch<{
    listings: ListingDTO[]
    total: number
    page: number
    pages: number
  }>(`/api/listings?${params.toString()}`, [
    category,
    city,
    query,
    minPrice,
    maxPrice,
    sort,
    page,
  ])

  const listings = data?.listings ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const pageItems = buildPageItems(page, pages)

  // W11 — clamp to a valid page; no-op when already there.
  function goToPage(target: number) {
    if (target < 1 || target > pages || target === page) return
    setPage(target)
  }

  const activeFilters =
    (category !== 'all' ? 1 : 0) +
    (city !== 'all' ? 1 : 0) +
    (minPrice !== '' ? 1 : 0) +
    (maxPrice !== '' ? 1 : 0)

  function clearAll() {
    setPage(1)
    setCategory('all')
    setCity('all')
    setQuery('')
    setMinPrice('')
    setMaxPrice('')
    setSort('featured')
    go({ name: 'browse' })
  }

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          دسته‌بندی
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={category === 'all'}
            onClick={() => applyFilter(() => setCategory('all'))}
          >
            همه
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={category === c.slug}
              onClick={() => applyFilter(() => setCategory(c.slug))}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          شهر
        </Label>
        <Select
          value={city}
          onValueChange={(v) => applyFilter(() => setCity(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="همه شهرها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه شهرها</SelectItem>
            {CITIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          قیمت روزانه (تومان)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="حداقل"
            value={minPrice}
            onChange={(e) =>
              applyFilter(() =>
                setMinPrice(e.target.value === '' ? '' : Number(e.target.value)),
              )
            }
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="حداکثر"
            value={maxPrice}
            onChange={(e) =>
              applyFilter(() =>
                setMaxPrice(e.target.value === '' ? '' : Number(e.target.value)),
              )
            }
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((p, i) => (
            <button
              key={p}
              onClick={() => {
                applyFilter(() => {
                  setMinPrice(p)
                  setMaxPrice(PRICE_PRESETS[i + 1] ?? '')
                })
              }}
              className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {p === 0 ? 'همه' : `${toPersianDigits(p / 1000)}k+`}
            </button>
          ))}
        </div>
      </div>

      {activeFilters > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="w-full">
          <X className="size-4" /> پاک کردن همه فیلترها
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Search + sort row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => applyFilter(() => setQuery(e.target.value))}
            placeholder="جستجوی آگهی…"
            className="h-11 rounded-xl pr-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter trigger */}
          <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <SlidersHorizontal className="size-4" /> فیلترها
                {activeFilters > 0 && (
                  <Badge className="bg-primary text-primary-foreground">
                    {toPersianDigits(activeFilters)}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>فیلترها</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{FiltersPanel}</div>
            </SheetContent>
          </Sheet>

          <Select
            value={sort}
            onValueChange={(v) => applyFilter(() => setSort(v))}
          >
            <SelectTrigger className="h-11 w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl border bg-card p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4" /> فیلترها
            </h3>
            {FiltersPanel}
          </div>
        </aside>

        {/* Results */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? 'در حال بارگذاری…' : `${toPersianDigits(total)} آگهی پیدا شد`}
            </p>
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                <MapPin className="size-3" />
                {categories.find((c) => c.slug === category)?.name}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                <Search className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">آگهی‌ای پیدا نشد</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                فیلترها یا عبارت جستجو را تغییر دهید.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearAll}>
                پاک کردن فیلترها
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}

          {/* W11 — Persian pagination below the results grid. In RTL the DOM
              order puts «قبلی» (first item) on the right and «بعدی» (last
              item) on the left, which is the correct Persian reading order. */}
          {!loading && total > 0 && pages > 1 && page <= pages && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={
                      page <= 1 ? 'pointer-events-none opacity-50' : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(page - 1)
                    }}
                  >
                    <ChevronRightIcon />
                    <span className="hidden sm:block">قبلی</span>
                  </PaginationPrevious>
                </PaginationItem>

                {pageItems.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        onClick={(e) => {
                          e.preventDefault()
                          goToPage(item)
                        }}
                      >
                        {toPersianDigits(item)}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= pages}
                    className={
                      page >= pages
                        ? 'pointer-events-none opacity-50'
                        : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(page + 1)
                    }}
                  >
                    <span className="hidden sm:block">بعدی</span>
                    <ChevronLeftIcon />
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'hover:bg-muted')
      }
    >
      {children}
    </button>
  )
}
