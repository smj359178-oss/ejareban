import { CURRENCY } from './constants'
import {
  toPersianDigits,
  timeAgoFa,
  formatJalaliDate,
  formatJalaliDateShort,
} from './persian'

/** Format a Toman amount with thousands separators and Persian digits. */
export function formatToman(amount: number, withSymbol = true): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat(CURRENCY.locale).format(rounded)
  const fa = toPersianDigits(formatted)
  return withSymbol ? `${fa} ${CURRENCY.symbol}` : fa
}

/** Compact form for large numbers, e.g. "1.2B Toman". */
export function formatTomanCompact(amount: number): string {
  if (amount >= 1_000_000_000)
    return `${toPersianDigits((amount / 1_000_000_000).toFixed(1).replace(/\.0$/, ''))} میلیارد ت`
  if (amount >= 1_000_000)
    return `${toPersianDigits((amount / 1_000_000).toFixed(1).replace(/\.0$/, ''))} م ت`
  if (amount >= 1_000)
    return `${toPersianDigits(Math.round(amount / 1_000))} هـ ت`
  return `${toPersianDigits(amount)} ت`
}

/** Relative Jalali time: e.g. "3 days ago". */
export function timeAgo(iso: string): string {
  return timeAgoFa(iso)
}

export function formatDate(iso: string | Date): string {
  return formatJalaliDate(iso)
}

export function formatDateShort(iso: string | Date): string {
  return formatJalaliDateShort(iso)
}

export function ratingLabel(rating: number, count: number): string {
  if (count === 0) return 'هنوز نظری ثبت نشده'
  return `${toPersianDigits(rating.toFixed(1))} (${toPersianDigits(count)})`
}
