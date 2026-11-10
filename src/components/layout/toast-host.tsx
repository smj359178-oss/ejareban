'use client'

import * as React from 'react'
import { useNav } from '@/lib/store'
import { toast } from 'sonner'

/** Bridges Zustand nav toast -> sonner toasts. Mount once near root. */
export function ToastHost() {
  const t = useNav((s) => s.toast)
  React.useEffect(() => {
    if (!t) return
    if (t.type === 'success') toast.success(t.message)
    else if (t.type === 'error') toast.error(t.message)
    else toast.info(t.message)
  }, [t])
  return null
}
