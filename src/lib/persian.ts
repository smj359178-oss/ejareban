import * as jalaali from 'jalaali-js'

// ---- Persian numerals ----
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Convert English digits to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)])
}

/** Convert Persian/Arabic digits to English (for numeric processing). */
export function toEnglishDigits(input: string): string {
  let out = input
  FA_DIGITS.forEach((f, i) => {
    out = out.replaceAll(f, EN_DIGITS[i])
  })
  // Arabic-Indic digits
  out = out.replaceAll('٠', '0').replaceAll('١', '1').replaceAll('٢', '2')
  out = out.replaceAll('٣', '3').replaceAll('٤', '4').replaceAll('٥', '5')
  out = out.replaceAll('٦', '6').replaceAll('٧', '7').replaceAll('٨', '8')
  out = out.replaceAll('٩', '9')
  return out
}

// ---- Persian search normalization ----
/**
 * Normalize Persian text for search:
 *  - Arabic Yeh/Kaf -> Persian Yeh/Kaf
 *  - Strip Arabic diacritics
 *  - Collapse ZWNJ and multiple spaces
 *  - Lowercase
 */
export function normalizePersian(input: string): string {
  if (!input) return ''
  return toEnglishDigits(input)
    .replace(/\u064A/g, '\u06CC') // ي → ی
    .replace(/\u0649/g, '\u06CC') // ـى → ی
    .replace(/\u0643/g, '\u06A9') // ك → ک
    .replace(/[\u064B-\u0652]/g, '') // اعراب
    .replace(/\u200c/g, ' ') // ZWNJ -> space (flexible matching)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ---- Jalali (Shamsi) dates ----

export interface JalaliDate {
  jy: number
  jm: number
  jd: number
}

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

const JALALI_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
]

const JALALI_WEEKDAYS_SHORT = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']

export function toJalali(date: Date): JalaliDate {
  const { jy, jm, jd } = jalaali.toJalaali(date)
  return { jy, jm, jd }
}

/**
 * B1 — display dates WITHOUT timezone drift.
 *
 * Booking/availability dates are stored as UTC midnight (`YYYY-MM-DDT00:00Z`).
 * Converting them through the LOCAL clock (new Date(...) + getFullYear())
 * re-derives the calendar day in the viewer's timezone: in Tehran that is
 * still the same day (+03:30), but in any negative-offset zone it would show
 * the previous day. Since these values are DATE-ONLY semantics, we extract
 * the Y/M/D straight from the stored string (or UTC getters) and run the
 * Jalali conversion on those — zero timezone involvement.
 */
function splitDateOnly(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function toJalaliFromDateOrString(date: Date | string): JalaliDate {
  if (typeof date === 'string') {
    const parts = splitDateOnly(date)
    if (parts) {
      const { jy, jm, jd } = jalaali.toJalaali(parts.y, parts.m, parts.d)
      return { jy, jm, jd }
    }
    return toJalali(new Date(date))
  }
  return toJalali(date)
}

function utcWeekday(date: Date | string): number {
  if (typeof date === 'string') {
    const parts = splitDateOnly(date)
    if (parts) return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay()
    return new Date(date).getUTCDay()
  }
  return date.getUTCDay()
}

export function formatJalaliDate(
  date: Date | string,
  opts: { withWeekday?: boolean; short?: boolean } = {},
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const { jy, jm, jd } = toJalaliFromDateOrString(date)
  const month = JALALI_MONTHS[jm - 1]
  let out = `${toPersianDigits(jd)} ${month} ${toPersianDigits(jy)}`
  if (opts.withWeekday) {
    const wd = utcWeekday(date)
    out = `${JALALI_WEEKDAYS[wd]}، ${out}`
  }
  return out
}

export function formatJalaliDateShort(date: Date | string): string {
  const { jy, jm, jd } = toJalaliFromDateOrString(date)
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]}`
}

export function formatJalaliDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const time = `${toPersianDigits(String(d.getHours()).padStart(2, '0'))}:${toPersianDigits(
    String(d.getMinutes()).padStart(2, '0'),
  )}`
  return `${formatJalaliDate(d)} - ${time}`
}

/** Relative time in Persian: "3 days ago". */
export function timeAgoFa(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'همین حالا'
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${toPersianDigits(day)} روز پیش`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${toPersianDigits(mo)} ماه پیش`
  return `${toPersianDigits(Math.floor(mo / 12))} سال پیش`
}

/** Joined year in Persian (Jalali). */
export function joinedYearFa(iso: string): string {
  return toPersianDigits(toJalali(new Date(iso)).jy)
}

export {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  JALALI_WEEKDAYS_SHORT,
}
