'use client'

import * as React from 'react'
import {
  useSessionContext,
  type SessionUser,
} from '@/components/shared/session-provider'

export type { SessionUser }

/**
 * useSession — client hook for the authenticated user (backed by the global
 * SessionProvider, U2). The provider performs a SINGLE /api/session fetch per
 * page load; every component using this hook shares that result instead of
 * firing ~24 parallel requests.
 *
 * - `user` is null until the first fetch resolves, then either the user
 *   object or null (anonymous).
 * - `loading` is true until the first fetch resolves.
 * - `refresh()` re-fetches the session (after login / register).
 * - `logout()` POSTs /api/auth/logout and clears the shared user.
 */
export function useSession() {
  const ctx = useSessionContext()

  // Defensive fallback for render paths mounted outside the provider
  // (keeps the legacy self-fetch behaviour; the provider in layout.tsx
  // wraps the whole app so this path is effectively dead code).
  const [fallback, setFallback] = React.useState<{
    user: SessionUser | null
    loading: boolean
  }>({ user: null, loading: true })

  const fallbackRefresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/session', { cache: 'no-store' })
      const d = await r.json()
      setFallback({ user: d.user ?? null, loading: false })
    } catch {
      setFallback({ user: null, loading: false })
    }
  }, [])

  const fallbackLogout = React.useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await fallbackRefresh()
  }, [fallbackRefresh])

  React.useEffect(() => {
    if (!ctx) fallbackRefresh()
  }, [ctx, fallbackRefresh])

  if (ctx) {
    return {
      user: ctx.user,
      loading: ctx.loading,
      refresh: ctx.refresh,
      logout: ctx.logout,
    }
  }

  return {
    user: fallback.user,
    loading: fallback.loading,
    refresh: fallbackRefresh,
    logout: fallbackLogout,
  }
}
