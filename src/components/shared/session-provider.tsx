'use client'

import * as React from 'react'

export interface SessionUser {
  id: string
  name: string
  email: string
  username: string | null
  role: string
  avatar: string | null
  isIdentityVerified: boolean
  trustScore: number
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

/**
 * SessionProvider (U2) — ONE global /api/session fetch for the whole app.
 *
 * Previously every component that called `useSession()` (navbar, dashboard,
 * admin panel, chat panel, listing view…) fired its own /api/session request,
 * so a single page load produced ~24 parallel session round-trips. The
 * provider resolves the session once and shares it through context.
 *
 * use-session.ts re-exports a `useSession()` hook with the exact same shape
 * that reads from this context, so all existing call sites keep working.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/session', { cache: 'no-store' })
      const d = await r.json()
      setUser(d.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const value = React.useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSessionContext(): SessionContextValue | null {
  return React.useContext(SessionContext)
}
