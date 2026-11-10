import type { Listing, Category, User, Review, Booking } from '@prisma/client'
import { parseImages } from './types'
import { SERVICE_FEE_PERCENT } from './constants'
import type { ListingDTO, CategoryDTO, ReviewDTO, BookingDTO } from './types'

function rating(ratingSum: number, ratingCount: number): number {
  if (ratingCount === 0) return 0
  return Math.round((ratingSum / ratingCount) * 10) / 10
}

/**
 * Who is looking at the listing. `null`/`undefined` = anonymous guest.
 * Resolved by the API routes from `getSession(req)`.
 */
export interface ListingViewer {
  userId?: string | null
  isAdmin?: boolean
}

// =====================================================================
// PRIVACY POLICY (server-side enforcement — bug 12)
//
// Guests (user-reported requirement): must NOT see owner identity or the
// exact location of a listing.
//
//  - ANONYMOUS viewer:
//      * `owner` is fully masked — id is '' (never leaked), name/avatar are
//        null, trustScore/rating zeroed. Only the verification badge,
//        rating count and join date stay public.
//      * `address`, `lat`, `lng` are nulled.
//  - LOGGED-IN non-owner:
//      * owner id/name/avatar stay visible (the chat panel needs them),
//      * but `address`, `lat`, `lng` are STILL nulled — the exact address
//        is only for the owner and admins.
//  - OWNER or ADMIN: everything as before (full detail).
//
// The client CANNOT bypass this: masking happens here on the server before
// the JSON leaves the API. Every route returning listings must pass the
// viewer resolved from `getSession(req)`.
// =====================================================================

export function mapCategory(c: Category): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? null,
    image: c.image ?? null,
    color: c.color ?? null,
    parentId: c.parentId ?? null,
    listingCount: c.listingCount ?? 0,
  }
}

export function mapListing(
  l: Listing & { category: Category | null; owner: User },
  viewer?: ListingViewer | null,
): ListingDTO {
  const isOwner = !!viewer?.userId && viewer.userId === l.owner.id
  const isAdmin = !!viewer?.isAdmin
  const isAnonymous = !viewer?.userId

  // Location privacy: exact address / coordinates are only for the owner
  // and admins (city stays public for everyone).
  const showExactLocation = isOwner || isAdmin

  // Owner identity privacy: anonymous users get a fully masked owner card
  // (no id, no name, no avatar). Logged-in users see id/name/avatar — the
  // chat panel needs the owner id to start a conversation.
  const owner: ListingDTO['owner'] = isAnonymous
    ? {
        id: '', // never leak the owner id to guests
        name: null,
        avatar: null,
        trustScore: 0,
        rating: 0,
        ratingCount: l.owner.ratingCount,
        isIdentityVerified: l.owner.isIdentityVerified,
        isPhoneVerified: l.owner.isPhoneVerified,
        createdAt: l.owner.createdAt.toISOString(),
      }
    : {
        id: l.owner.id,
        name: l.owner.name,
        avatar: l.owner.avatar ?? null,
        trustScore: l.owner.trustScore,
        rating: rating(l.owner.ratingSum, l.owner.ratingCount),
        ratingCount: l.owner.ratingCount,
        isIdentityVerified: l.owner.isIdentityVerified,
        isPhoneVerified: l.owner.isPhoneVerified,
        createdAt: l.owner.createdAt.toISOString(),
      }

  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    description: l.description,
    condition: l.condition as ListingDTO['condition'],
    images: parseImages(l.images),
    brand: l.brand ?? null,
    model: l.model ?? null,
    city: l.city,
    address: showExactLocation ? (l.address ?? null) : null,
    lat: showExactLocation ? (l.lat ?? null) : null,
    lng: showExactLocation ? (l.lng ?? null) : null,
    dailyPrice: l.dailyPrice,
    weeklyPrice: l.weeklyPrice ?? null,
    monthlyPrice: l.monthlyPrice ?? null,
    deposit: l.deposit,
    minRentalDays: l.minRentalDays,
    maxRentalDays: l.maxRentalDays ?? null,
    deliveryAvailable: l.deliveryAvailable,
    deliveryFee: l.deliveryFee,
    replacementValue: l.replacementValue ?? null,
    status: l.status as ListingDTO['status'],
    moderationStatus: l.moderationStatus as ListingDTO['moderationStatus'],
    featured: l.featured,
    ratingSum: l.ratingSum,
    ratingCount: l.ratingCount,
    rating: rating(l.ratingSum, l.ratingCount),
    views: l.views,
    bookingsCount: l.bookingsCount,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    categoryId: l.categoryId,
    category: l.category ? mapCategory(l.category) : null,
    owner,
  }
}

export function mapReview(r: Review & { reviewer: User }): ReviewDTO {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    reviewer: {
      id: r.reviewer.id,
      name: r.reviewer.name,
      avatar: r.reviewer.avatar ?? null,
    },
  }
}

export function mapBooking(
  b: Booking & {
    listing: Listing
    renter: User
    owner: User
  },
): BookingDTO {
  return {
    id: b.id,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    days: b.days,
    pricingTier: b.pricingTier as BookingDTO['pricingTier'],
    dailyRate: b.dailyRate,
    rentalPrice: b.rentalPrice,
    depositTotal: b.depositTotal,
    deliveryFee: b.deliveryFee,
    serviceFee: b.serviceFee,
    discount: b.discount,
    totalAmount: b.totalAmount,
    message: b.message ?? null,
    contractSigned: b.contractSigned,
    deliveryOption: b.deliveryOption as BookingDTO['deliveryOption'],
    status: b.status as BookingDTO['status'],
    paymentStatus: b.paymentStatus as BookingDTO['paymentStatus'],
    createdAt: b.createdAt.toISOString(),
    // --- Lifecycle fields (12-step flow) ---
    adminApprovedAt: b.adminApprovedAt?.toISOString() ?? null,
    ownerSignedAt: b.ownerSignedAt?.toISOString() ?? null,
    renterSignedAt: b.renterSignedAt?.toISOString() ?? null,
    paidAt: b.paidAt?.toISOString() ?? null,
    deliveredAt: b.deliveredAt?.toISOString() ?? null,
    returnedAt: b.returnedAt?.toISOString() ?? null,
    returnNote: b.returnNote ?? null,
    returnImages: b.returnImages ? parseImages(b.returnImages) : [],
    damageNote: b.damageNote ?? null,
    damageAmount: b.damageAmount ?? null,
    depositRefundedAt: b.depositRefundedAt?.toISOString() ?? null,
    depositRefundAmount: b.depositRefundAmount ?? null,
    settledAt: b.settledAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason ?? null,
    listing: {
      id: b.listing.id,
      slug: b.listing.slug,
      title: b.listing.title,
      images: parseImages(b.listing.images),
      city: b.listing.city,
    },
    renter: {
      id: b.renter.id,
      name: b.renter.name,
      avatar: b.renter.avatar ?? null,
    },
    owner: {
      id: b.owner.id,
      name: b.owner.name,
      avatar: b.owner.avatar ?? null,
    },
  }
}

export { SERVICE_FEE_PERCENT }
