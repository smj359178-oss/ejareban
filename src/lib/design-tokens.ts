/**
 * Ejareban Design System
 * ============================================
 *
 * Centralized design tokens that keep the visual language consistent across
 * the whole platform.
 *
 * Typography scale:
 *   display  : 3rem (48px) / 1.1   — hero heading
 *   h1       : 2rem (32px) / 1.2   — page title
 *   h2       : 1.5rem (24px) / 1.3  — section title
 *   h3       : 1.25rem (20px) / 1.4 — card / sub-section title
 *   h4       : 1.125rem (18px) / 1.4
 *   body-lg  : 1.125rem (18px) / 1.7 — large body text
 *   body     : 1rem (16px) / 1.7   — default body text
 *   body-sm  : 0.875rem (14px) / 1.6 — secondary text
 *   caption  : 0.75rem (12px) / 1.5 — caption / label
 *   overline : 0.6875rem (11px) / 1.4 uppercase — top label
 *
 * Spacing scale (4px base):
 *   0 = 0, 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 5 = 20px,
 *   6 = 24px, 8 = 32px, 10 = 40px, 12 = 48px, 16 = 64px, 20 = 80px
 *
 * Border radius:
 *   sm = 6px, md = 10px, lg = 14px, xl = 20px, 2xl = 28px, full = 9999px
 *
 * Shadows:
 *   xs, sm, md, lg, xl, 2xl — each adds a different elevation depth
 *
 * Status colors:
 *   success: emerald
 *   warning: amber
 *   error:   rose
 *   info:    sky
 */

export const typography = {
  display: { fontSize: '3rem', lineHeight: '1.1', fontWeight: 800 },
  h1: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 700 },
  h2: { fontSize: '1.5rem', lineHeight: '1.3', fontWeight: 700 },
  h3: { fontSize: '1.25rem', lineHeight: '1.4', fontWeight: 600 },
  h4: { fontSize: '1.125rem', lineHeight: '1.4', fontWeight: 600 },
  bodyLg: { fontSize: '1.125rem', lineHeight: '1.7', fontWeight: 400 },
  body: { fontSize: '1rem', lineHeight: '1.7', fontWeight: 400 },
  bodySm: { fontSize: '0.875rem', lineHeight: '1.6', fontWeight: 400 },
  caption: { fontSize: '0.75rem', lineHeight: '1.5', fontWeight: 500 },
  overline: {
    fontSize: '0.6875rem',
    lineHeight: '1.4',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
} as const

export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
} as const

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '9999px',
} as const

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const

/**
 * Status color tokens mapped to Tailwind classes.
 * Used by Badge, Alert, Toast and similar components.
 */
export const statusColors = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    solid: 'bg-emerald-600 text-white',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
    solid: 'bg-amber-500 text-white',
  },
  error: {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200 dark:ring-rose-800',
    solid: 'bg-rose-600 text-white',
  },
  info: {
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-800',
    solid: 'bg-sky-600 text-white',
  },
} as const

/**
 * User trust tiers.
 * Each tier has its own color and icon.
 */
export const trustTiers = {
  GOLD: {
    label: 'بانای طلایی',
    color: 'amber',
    icon: 'Crown',
    minScore: 90,
    minBookings: 10,
    minRating: 4.5,
  },
  SILVER: {
    label: 'بانای نقره‌ای',
    color: 'slate',
    icon: 'Shield',
    minScore: 75,
    minBookings: 3,
    minRating: 4.0,
  },
  BRONZE: {
    label: 'بانای برنزی',
    color: 'orange',
    icon: 'ShieldCheck',
    minScore: 50,
    minBookings: 1,
    minRating: 3.5,
  },
  NEW: {
    label: 'تازه‌وارد',
    color: 'zinc',
    icon: 'User',
    minScore: 0,
    minBookings: 0,
    minRating: 0,
  },
} as const

export type TrustTier = keyof typeof trustTiers
