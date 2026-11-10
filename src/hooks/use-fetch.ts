'use client'

import * as React from 'react'
import type {
  CategoryDTO,
  ListingDTO,
  ReviewDTO,
  BookingDTO,
} from '@/lib/types'

export function useFetch<T>(
  url: string | null,
  deps: React.DependencyList = [],
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(!!url)
  const [error, setError] = React.useState<string | null>(null)
  const [nonce, setNonce] = React.useState(0)

  React.useEffect(() => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    fetch(url)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'خطا در دریافت اطلاعات')
        return d
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'خطا در دریافت اطلاعات'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [url, nonce, ...deps])

  return { data, loading, error, reload: () => setNonce((n) => n + 1) }
}

export type { CategoryDTO, ListingDTO, ReviewDTO, BookingDTO }
