import {
  BOOKING_STATUS_META,
  CONDITION_LABELS,
  type BookingStatus,
  type DeliveryOption,
  type ItemCondition,
  type ListingStatus,
  type ModerationStatus,
  type PaymentStatus,
  type PricingTier,
  type UserRole,
} from './constants'

// Re-export for convenient single-import usage across the UI layer.
export {
  BOOKING_STATUS_META,
  CONDITION_LABELS,
  type BookingStatus,
  type DeliveryOption,
  type ItemCondition,
  type ListingStatus,
  type ModerationStatus,
  type PaymentStatus,
  type PricingTier,
  type UserRole,
}

// ---- Prisma row -> API-facing shape ----
// `images` is a JSON string in SQLite; we surface it as a typed array.

export interface UserDTO {
  id: string
  email: string
  name: string
  avatar: string | null
  phone: string | null
  isIdentityVerified: boolean
  isPhoneVerified: boolean
  twoFactorEnabled: boolean
  role: UserRole
  trustScore: number
  ratingSum: number
  ratingCount: number
  city: string | null
  bio: string | null
  createdAt: string
}

export interface CategoryDTO {
  id: string
  name: string
  slug: string
  icon: string | null
  image: string | null
  color: string | null
  parentId: string | null
  listingCount: number
}

export interface ListingDTO {
  id: string
  slug: string
  title: string
  description: string
  condition: ItemCondition
  images: string[]
  brand: string | null
  model: string | null
  city: string
  address: string | null
  lat: number | null
  lng: number | null

  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  deposit: number
  minRentalDays: number
  maxRentalDays: number | null

  deliveryAvailable: boolean
  deliveryFee: number
  replacementValue: number | null

  status: ListingStatus
  moderationStatus: ModerationStatus
  featured: boolean

  ratingSum: number
  ratingCount: number
  rating: number
  views: number
  bookingsCount: number

  createdAt: string
  updatedAt: string

  categoryId: string
  category: CategoryDTO | null
  owner: {
    id: string
    // Privacy (bug 12): for ANONYMOUS viewers the API masks the owner —
    // name/avatar arrive as null and id is '' (never the real id).
    name: string | null
    avatar: string | null
    trustScore: number
    rating: number
    ratingCount: number
    isIdentityVerified: boolean
    isPhoneVerified: boolean
    createdAt: string
  }
}

export interface BookingDTO {
  id: string
  startDate: string
  endDate: string
  days: number
  pricingTier: PricingTier
  dailyRate: number
  rentalPrice: number
  depositTotal: number
  deliveryFee: number
  serviceFee: number
  discount: number
  totalAmount: number
  message: string | null
  contractSigned: boolean
  deliveryOption: DeliveryOption
  status: BookingStatus
  paymentStatus: PaymentStatus
  createdAt: string
  // --- Lifecycle (12-step flow) ---
  adminApprovedAt: string | null
  ownerSignedAt: string | null
  renterSignedAt: string | null
  paidAt: string | null
  deliveredAt: string | null
  returnedAt: string | null
  returnNote: string | null
  returnImages: string[]
  damageNote: string | null
  damageAmount: number | null
  depositRefundedAt: string | null
  depositRefundAmount: number | null
  settledAt: string | null
  cancellationReason: string | null
  listing: {
    id: string
    slug: string
    title: string
    images: string[]
    city: string
  }
  renter: { id: string; name: string; avatar: string | null }
  owner: { id: string; name: string; avatar: string | null }
}

export interface ReviewDTO {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewer: { id: string; name: string; avatar: string | null }
}

export interface AvailabilityDTO {
  date: string // ISO date (YYYY-MM-DD)
  isBlocked: boolean
  reason: string | null
}

// ---- Chat (real-time via socket.io mini-service on port 3001) ----

export interface ChatMessageDTO {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  text: string
  createdAt: string
}

export interface ConversationDTO {
  id: string
  listingId: string
  listing: {
    id: string
    slug: string
    title: string
    images: string[]
  } | null
  otherUser: {
    id: string
    name: string
    avatar: string | null
  }
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  createdAt: string
}

// ---- Parsing helpers (JSON-string fields in SQLite) ----
export function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function serializeImages(arr: string[]): string {
  return JSON.stringify(arr)
}
