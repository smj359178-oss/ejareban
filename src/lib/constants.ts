// Domain constants — kept as plain string unions for cross-engine portability.

export const USER_ROLES = {
  USER: 'USER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
} as const
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const ITEM_CONDITIONS = {
  NEW: 'NEW',
  LIKE_NEW: 'LIKE_NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
} as const
export type ItemCondition = (typeof ITEM_CONDITIONS)[keyof typeof ITEM_CONDITIONS]

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  NEW: 'نو',
  LIKE_NEW: 'مانند نو',
  GOOD: 'خوب',
  FAIR: 'قابل قبول',
}

export const LISTING_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  RENTED: 'RENTED',
  PAUSED: 'PAUSED',
} as const
export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS]

export const MODERATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ModerationStatus =
  (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS]

export const PRICING_TIERS = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const
export type PricingTier = (typeof PRICING_TIERS)[keyof typeof PRICING_TIERS]

export const DELIVERY_OPTIONS = {
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
} as const
export type DeliveryOption =
  (typeof DELIVERY_OPTIONS)[keyof typeof DELIVERY_OPTIONS]

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const
export type BookingStatus =
  (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; tone: string }
> = {
  PENDING: { label: 'در انتظار', tone: 'amber' },
  APPROVED: { label: 'تأیید شد', tone: 'blue' },
  ACTIVE: { label: 'در حال اجاره', tone: 'emerald' },
  COMPLETED: { label: 'تکمیل شد', tone: 'slate' },
  DECLINED: { label: 'رد شد', tone: 'rose' },
  CANCELLED: { label: 'لغو شد', tone: 'zinc' },
}

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
  FAILED: 'FAILED',
} as const
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const REPORT_REASONS = [
  'spam',
  'scam',
  'inappropriate',
  'duplicate',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[keyof typeof REPORT_REASONS]

// Service fee percentage applied on top of rental price (platform revenue).
export const SERVICE_FEE_PERCENT = 0.07

// Cities covered in the initial release
export const CITIES = [
  'تهران',
  'کرج',
  'اصفهان',
  'شیراز',
  'تبریز',
  'مشهد',
  'اهواز',
  'قم',
] as const

// Currency — Iranian Toman
export const CURRENCY = {
  code: 'IRT',
  symbol: 'تومان',
  label: 'تومان',
  locale: 'en-US',
}

export const REPORT_REASONS_FA: Record<string, string> = {
  spam: 'هرزنامه',
  scam: 'کلاهبرداری',
  inappropriate: 'محتوای نامناسب',
  duplicate: 'مکرر/تکراری',
  other: 'سایر',
}
