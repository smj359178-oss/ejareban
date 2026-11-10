import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapListing } from '@/lib/mappers'
import { Prisma } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizePersian, toEnglishDigits } from '@/lib/persian'
import { getSession } from '@/lib/auth'
import { serializeImages } from '@/lib/types'
import { assertSameOrigin } from '@/lib/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/listings — public search/browse
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  // Resolve the session once: used for rate-limit keying, owner=self and
  // viewer-aware privacy in mapListing.
  const { user } = await getSession(req)
  const viewer = user ? { userId: user.id, isAdmin: user.role === 'ADMIN' } : null

  // Rate limiting on the search route (raised to 120/min; keyed by user id
  // when logged in so shared NAT IPs don't throttle each other).
  const rl = checkRateLimit(req, 'search', user ? `user:${user.id}` : undefined)
  if (!rl.ok) return rl.response
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') // slug
  const city = searchParams.get('city')
  const rawQ = searchParams.get('q')?.trim()
  const q = rawQ ? normalizePersian(rawQ) : ''
  const minPriceRaw = toEnglishDigits(searchParams.get('minPrice') || '')
  const maxPriceRaw = toEnglishDigits(searchParams.get('maxPrice') || '')
  const minPrice = Number(minPriceRaw) || undefined
  const maxPrice = Number(maxPriceRaw) || undefined
  const sort = searchParams.get('sort') || 'featured'
  const featured = searchParams.get('featured') === 'true'
  const limit = Math.min(Number(searchParams.get('limit')) || 24, 48)
  // W11 — page-based pagination (1-indexed). `offset` stays supported for
  // backward compatibility; when both are given page wins.
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const page = Math.max(Number(searchParams.get('page')) || 0, 0)
  const effectiveOffset = page > 0 ? (page - 1) * limit : offset
  // owner=self — return only the caller's own listings (used by dashboard)
  const ownerSelf = searchParams.get('owner') === 'self'

  const where: Prisma.ListingWhereInput = {
    status: 'ACTIVE',
    moderationStatus: 'APPROVED',
  }
  if (ownerSelf) {
    if (!user) return NextResponse.json({ listings: [], total: 0, limit, offset })
    // Override the public where with "owned by me, any status"
    delete where.status
    delete where.moderationStatus
    where.ownerId = user.id
  }
  if (category && category !== 'all') {
    where.category = { slug: category }
  }
  if (city && city !== 'all') where.city = city
  if (minPrice != null || maxPrice != null) {
    where.dailyPrice = {}
    if (minPrice != null) where.dailyPrice.gte = minPrice
    if (maxPrice != null) where.dailyPrice.lte = maxPrice
  }
  if (featured) where.featured = true

  // Prisma's orderBy can be either a single object or an array; both shapes
  // are valid for findMany. We declare the type as a union so the final
  // `[{ featured: 'desc' }, { bookingsCount: 'desc' }]` array case type-checks.
  const orderBy: Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[] =
    sort === 'price_asc'
      ? { dailyPrice: 'asc' }
      : sort === 'price_desc'
        ? { dailyPrice: 'desc' }
        : sort === 'rating'
          ? { ratingCount: 'desc' }
          : sort === 'newest'
            ? { createdAt: 'desc' }
            : [{ featured: 'desc' }, { bookingsCount: 'desc' }]

  // For Persian search, we fetch a larger candidate set then filter with
  // normalized matching (handles Arabic Yeh/Kaf, ZWNJ, Persian digits, accents).
  // PostgreSQL full-text search (pg_trgm) will replace this at scale.
  const fetchLimit = q ? 200 : limit
  const [candidates, total] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy,
      skip: q ? 0 : effectiveOffset,
      take: fetchLimit,
      include: { category: true, owner: true },
    }),
    db.listing.count({ where }),
  ])

  let listings = candidates
  let filteredTotal = total
  if (q) {
    listings = candidates.filter((l) => {
      const hay = normalizePersian(
        [l.title, l.description, l.brand, l.model, l.city].join(' '),
      )
      return hay.includes(q)
    })
    // W11: keep the FULL filtered count for pagination before slicing.
    filteredTotal = listings.length
    listings = listings.slice(effectiveOffset, effectiveOffset + limit)
  }

  // Server-side privacy: guests get masked owner + no address/lat/lng.
  return NextResponse.json({
    listings: listings.map((l) => mapListing(l, viewer)),
    total: filteredTotal,
    limit,
    offset: effectiveOffset,
    page: page > 0 ? page : Math.floor(effectiveOffset / limit) + 1,
    pages: Math.max(Math.ceil(filteredTotal / limit), 1),
  })
}

// ---------------------------------------------------------------------------
// POST /api/listings — create a new listing (auth required, any logged-in user)
// ---------------------------------------------------------------------------
const CreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  categoryId: z.string(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']).default('GOOD'),
  brand: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  city: z.string().min(1).max(60),
  address: z.string().max(200).optional(),
  dailyPrice: z.number().min(0),
  weeklyPrice: z.number().min(0).optional(),
  monthlyPrice: z.number().min(0).optional(),
  deposit: z.number().min(0).default(0),
  minRentalDays: z.number().int().min(1).max(365).default(1),
  maxRentalDays: z.number().int().min(1).max(3650).optional(),
  deliveryAvailable: z.boolean().default(false),
  deliveryFee: z.number().min(0).default(0),
  replacementValue: z.number().min(0).optional(),
  images: z.array(z.string()).min(1).max(8),
})

function makeSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii) return `${ascii}-${Math.random().toString(36).slice(2, 6)}`
  // Persian titles fall back to a hash-based slug
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0
  return `l-${Math.abs(h).toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  const { user } = await getSession(req)
  if (!user) {
    return NextResponse.json({ error: 'برای ثبت آگهی باید وارد شوید.' }, { status: 401 })
  }
  // Rate limit: 20 listings per 10 minutes per user
  const rl = checkRateLimit(req, 'createBooking', `create-listing:${user.id}`)
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Verify the category exists.
  const category = await db.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  })
  if (!category) {
    return NextResponse.json({ error: 'دسته‌بندی یافت نشد.' }, { status: 400 })
  }

  const slug = makeSlug(parsed.data.title)
  const listing = await db.listing.create({
    data: {
      ownerId: user.id,
      categoryId: parsed.data.categoryId,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      condition: parsed.data.condition,
      images: serializeImages(parsed.data.images),
      brand: parsed.data.brand ?? null,
      model: parsed.data.model ?? null,
      city: parsed.data.city,
      address: parsed.data.address ?? null,
      dailyPrice: parsed.data.dailyPrice,
      weeklyPrice: parsed.data.weeklyPrice ?? null,
      monthlyPrice: parsed.data.monthlyPrice ?? null,
      deposit: parsed.data.deposit,
      minRentalDays: parsed.data.minRentalDays,
      maxRentalDays: parsed.data.maxRentalDays ?? null,
      deliveryAvailable: parsed.data.deliveryAvailable,
      deliveryFee: parsed.data.deliveryFee,
      replacementValue: parsed.data.replacementValue ?? null,
      // New listings always start as PENDING — admin must approve before
      // they go public.
      status: 'ACTIVE',
      moderationStatus: 'PENDING',
      featured: false,
    },
    include: { category: true, owner: true },
  })

  // The creator is the owner → full detail (address/lat/lng included).
  return NextResponse.json(
    { listing: mapListing(listing, { userId: user.id, isAdmin: user.role === 'ADMIN' }) },
    { status: 201 },
  )
}
