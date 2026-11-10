import { SERVICE_FEE_PERCENT, PRICING_TIERS, type PricingTier } from './constants'

// ---- Date helpers (timezone-agnostic; normalized to midnight UTC) ----

export function startOfDateUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
}

/**
 * B1 — LOCAL day key.
 *
 * `toISOString().slice(0, 10)` derives the calendar day from UTC. For a user
 * in Asia/Tehran (+03:30) local midnight of e.g. March 10 is March 9 at
 * 20:30 UTC, so UTC-based keys shifted every picked/displayed date one day
 * back (the "تقویم یک روز جابجا" bug).
 *
 * This helper keys a Date by its LOCAL wall-clock components, so the key
 * always matches what the user actually selected on the calendar. It is
 * used consistently by the booking calendar (matcher + payload) and by the
 * availability response (plain strings — no Date round-trip).
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD key into a UTC-midnight Date (storage format). */
export function parseLocalDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

export function toISODate(d: Date): string {
  // YYYY-MM-DD in UTC
  return d.toISOString().slice(0, 10)
}

export function parseISODate(s: string): Date {
  // Treat YYYY-MM-DD as a UTC midnight date
  return new Date(`${s}T00:00:00.000Z`)
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + days)
  return r
}

export function diffDays(a: Date, b: Date): number {
  const ms = startOfDateUTC(b).getTime() - startOfDateUTC(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Inclusive day count for a rental range [start, end]. */
export function rentalDays(startDate: Date, endDate: Date): number {
  return diffDays(startDate, endDate) + 1
}

/** All calendar days (inclusive) between two dates as ISO strings. */
export function enumerateDays(startDate: Date, endDate: Date): string[] {
  const out: string[] = []
  const start = startOfDateUTC(startDate)
  const end = startOfDateUTC(endDate)
  let cur = start
  while (cur.getTime() <= end.getTime()) {
    out.push(toISODate(cur))
    cur = addDays(cur, 1)
  }
  return out
}

// ---- Pricing engine ----

export interface PriceInput {
  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  deposit: number
  deliveryFee: number
  deliveryAvailable: boolean
  days: number
  deliveryOption: 'PICKUP' | 'DELIVERY'
}

export interface PriceBreakdown {
  pricingTier: PricingTier
  dailyRate: number
  rentalPrice: number
  depositTotal: number
  deliveryFee: number
  serviceFee: number
  discount: number
  totalAmount: number
}

/**
 * Choose the best pricing tier for the requested number of days:
 *  - >= 30 days & monthly rate set  -> MONTHLY (prorated)
 *  - >= 7 days  & weekly rate set   -> WEEKLY (prorated)
 *  - otherwise                       -> DAILY
 * The prorated daily rate from a tier is always used when it beats the
 * flat daily rate, giving renters automatic volume discounts.
 */
export function chooseTier(
  days: number,
  dailyPrice: number,
  weeklyPrice: number | null,
  monthlyPrice: number | null,
): { tier: PricingTier; dailyRate: number } {
  const monthlyDaily = monthlyPrice != null ? monthlyPrice / 30 : Infinity
  const weeklyDaily = weeklyPrice != null ? weeklyPrice / 7 : Infinity
  const candidates: { tier: PricingTier; dailyRate: number; minDays: number }[] =
    [
      { tier: PRICING_TIERS.MONTHLY, dailyRate: monthlyDaily, minDays: 30 },
      { tier: PRICING_TIERS.WEEKLY, dailyRate: weeklyDaily, minDays: 7 },
      { tier: PRICING_TIERS.DAILY, dailyRate: dailyPrice, minDays: 1 },
    ]
  for (const c of candidates) {
    if (days >= c.minDays && Number.isFinite(c.dailyRate) && c.dailyRate > 0) {
      return c
    }
  }
  return { tier: PRICING_TIERS.DAILY, dailyRate: dailyPrice }
}

export function computePrice(input: PriceInput): PriceBreakdown {
  const { days } = input
  const { tier, dailyRate } = chooseTier(
    days,
    input.dailyPrice,
    input.weeklyPrice,
    input.monthlyPrice,
  )
  const rentalPrice = Math.round(dailyRate * days)
  const serviceFee = Math.round(rentalPrice * SERVICE_FEE_PERCENT)
  const deliveryFee =
    input.deliveryOption === 'DELIVERY' && input.deliveryAvailable
      ? input.deliveryFee
      : 0
  const depositTotal = input.deposit
  const totalAmount = rentalPrice + serviceFee + deliveryFee + depositTotal
  return {
    pricingTier: tier,
    dailyRate,
    rentalPrice,
    depositTotal,
    deliveryFee,
    serviceFee,
    discount: 0,
    totalAmount,
  }
}
