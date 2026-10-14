'use client'

import { create } from 'zustand'

export type View =
  | { name: 'home' }
  | { name: 'browse'; categorySlug?: string; query?: string }
  | { name: 'listing'; slug: string }
  | { name: 'dashboard'; tab?: 'listings' | 'bookings' | 'favorites' }
  | { name: 'admin'; tab?: 'listings' | 'bookings' | 'users' | 'reports' | 'verifications' }
  | { name: 'new-listing' }

// ---------------------------------------------------------------------
// U1 — URL synchronization + browser back button.
//
// The SPA previously kept its navigation purely inside a zustand store,
// so the browser Back button either did nothing or left the site entirely.
// Now every `go()` pushes a hash URL and `popstate` re-derives the view:
//
//     #/                      → home
//     #/browse?cat=x&q=y      → browse
//     #/listing/<slug>        → listing
//     #/dashboard/<tab>       → dashboard
//     #/admin/<tab>           → admin
//     #/new-listing           → new listing form
//
// The internal `history` stack is gone on purpose: the BROWSER history is
// the single source of truth, so the in-app «بازگشت» button and the
// browser Back button always agree.
// ---------------------------------------------------------------------

const DASHBOARD_TABS = ['listings', 'bookings', 'favorites'] as const
const ADMIN_TABS = ['listings', 'bookings', 'users', 'reports', 'verifications'] as const

export function viewToHash(view: View): string {
  switch (view.name) {
    case 'home':
      return '#/'
    case 'browse': {
      const p = new URLSearchParams()
      if (view.categorySlug) p.set('cat', view.categorySlug)
      if (view.query) p.set('q', view.query)
      const qs = p.toString()
      return `#/browse${qs ? `?${qs}` : ''}`
    }
    case 'listing':
      return `#/listing/${encodeURIComponent(view.slug)}`
    case 'dashboard':
      return `#/dashboard${view.tab ? `/${view.tab}` : ''}`
    case 'admin':
      return `#/admin${view.tab ? `/${view.tab}` : ''}`
    case 'new-listing':
      return '#/new-listing'
  }
}

export function hashToView(hash: string): View | null {
  if (!hash || hash === '#' || hash === '#/') return { name: 'home' }
  const raw = hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(query)

  switch (parts[0]) {
    case undefined:
    case '':
      return { name: 'home' }
    case 'browse':
      return {
        name: 'browse',
        categorySlug: params.get('cat') || undefined,
        query: params.get('q') || undefined,
      }
    case 'listing':
      return parts[1] ? { name: 'listing', slug: decodeURIComponent(parts[1]) } : null
    case 'dashboard': {
      const tab = DASHBOARD_TABS.find((t) => t === parts[1])
      return { name: 'dashboard', tab: tab || undefined }
    }
    case 'admin': {
      const tab = ADMIN_TABS.find((t) => t === parts[1])
      return { name: 'admin', tab: tab || undefined }
    }
    case 'new-listing':
      return { name: 'new-listing' }
    default:
      return null
  }
}

/** How many history entries THIS app pushed (guards back() on fresh loads). */
let pushCount = 0

interface NavState {
  view: View
  go: (view: View) => void
  back: () => void
  // simple toast
  toast: { id: number; message: string; type: 'success' | 'error' | 'info' } | null
  notify: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
}

let toastId = 0

export const useNav = create<NavState>((set, get) => ({
  view: { name: 'home' },
  toast: null,
  go: (view) => {
    const h = viewToHash(view)
    try {
      if (typeof window !== 'undefined' && window.location.hash !== h) {
        window.history.pushState(null, '', h)
        pushCount++
      }
    } catch {
      /* history unavailable (SSR safety) */
    }
    set({ view })
  },
  back: () => {
    // U1: delegate to the browser — popstate → hashToView → store update.
    if (pushCount > 0) {
      window.history.back()
    } else {
      get().go({ name: 'home' })
    }
  },
  notify: (message, type = 'success') => {
    const id = ++toastId
    set({ toast: { id, message, type } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3500)
  },
  clearToast: () => set({ toast: null }),
}))

/**
 * initRouter — call ONCE on the client (page.tsx effect). Deep-links the
 * current hash into the store and keeps it in sync with browser navigation.
 * Returns a cleanup function.
 */
export function initRouter(): () => void {
  const apply = () => {
    const view = hashToView(window.location.hash) ?? { name: 'home' }
    // popstate → the URL already changed; just mirror it into the store
    // without pushing a new history entry.
    useNav.setState({ view })
  }

  // Initial deep-link (replace, not push).
  const initial = hashToView(window.location.hash)
  if (initial) useNav.setState({ view: initial })

  window.addEventListener('popstate', apply)
  return () => window.removeEventListener('popstate', apply)
}
