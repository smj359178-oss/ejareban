'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/use-session'

/**
 * /login — public login page.
 *
 * The form posts to /api/auth/login and on success refreshes the session and
 * redirects to `/` (home) where the navbar will already show the logged-in
 * user.
 *
 * Error UX (bug 1-UI): 429 (lockout) gets a calm, actionable message; 401
 * shows the server's Persian message plus a muted hint about the temporary
 * 8-attempt lockout so users understand what is happening instead of feeling
 * hacked.
 *
 * Demo credentials are shown as a hint so the seeded accounts are easy to
 * discover during local development. Remove the hint block before shipping
 * to production.
 */
export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useSession()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [lockHint, setLockHint] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLockHint(false)
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await r.json()
      if (!r.ok) {
        if (r.status === 429 || data?.retryAfter) {
          setError(
            'تلاش‌های ناموفق بیش از حد مجاز است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.',
          )
        } else if (r.status === 401) {
          setError(data?.error ?? 'نام کاربری یا رمز عبور اشتباه است.')
          setLockHint(true)
        } else {
          setError(data?.error ?? 'خطا در ورود')
        }
        return
      }
      await refresh()
      router.push('/')
    } catch {
      setError('اتصال به سرور ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-sky-950/30">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-bold">ورود به اجاره‌بان</h1>
          <p className="text-sm text-muted-foreground">
            با نام کاربری یا ایمیل و رمز عبور خود وارد شوید.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">نام کاربری یا ایمیل</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="مثلاً: admin یا admin@ejareban.app"
              required
              autoComplete="username"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              dir="ltr"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
            >
              {error}
            </div>
          )}
          {lockHint && (
            <p className="text-xs leading-5 text-muted-foreground">
              پس از ۸ تلاش ناموفق، ورود به‌طور موقت مسدود می‌شود. اگر رمز خود را فراموش
              کرده‌اید، کمی بعد دوباره تلاش کنید.
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            <LogIn className="size-4" />
            {loading ? 'در حال ورود...' : 'ورود'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          حساب ندارید؟{' '}
          <Link href="/register" className="font-medium text-emerald-700 hover:underline">
            ثبت‌نام کنید
          </Link>
        </div>

        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-semibold">حساب‌های پیش‌فرض (توسعه محلی):</div>
          <ul className="space-y-1 leading-6" dir="ltr">
            <li>admin / ejareban-admin</li>
            <li>renter / renter123</li>
            <li>amir / amir123</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
