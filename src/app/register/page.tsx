'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/use-session'
import { CITIES } from '@/lib/constants'
import { toEnglishDigits } from '@/lib/persian'

/**
 * /register — public registration page for a new customer (USER role).
 *
 * The form posts to /api/auth/register and on success refreshes the session
 * and redirects to `/`. On 409 (username/email/phone taken) we show the
 * Persian error returned by the API.
 *
 * Phone (bug 15 client side): digits are normalized fa/ar → en and
 * spaces/dashes/parentheses are stripped BEFORE submit; an invalid (but
 * non-empty) number is rejected locally with a rose field error so the API
 * is never called unnecessarily. `phone` is unique in the DB — the server
 * normalizes empty → null so the "phone already taken" duplicate-key bug
 * cannot happen again.
 *
 * The customer can later promote themselves to OWNER by posting their first
 * listing — that flow lives in the dashboard.
 */

const PHONE_REGEX = /^(\+98|0098|0)?9\d{9}$/

export default function RegisterPage() {
  const router = useRouter()
  const { refresh } = useSession()
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    city: CITIES[0],
  })
  const [error, setError] = React.useState<string | null>(null)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  function setField<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  /** fa/ar digits → en, strip spaces/dashes/parentheses (bug 15). */
  function normalizePhone(raw: string): string {
    return toEnglishDigits(raw).replace(/[\s\-()]/g, '')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldError(null)
    const phone = normalizePhone(form.phone)
    if (phone && !PHONE_REGEX.test(phone)) {
      setFieldError('شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phone }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data?.error ?? 'خطا در ثبت‌نام')
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-8 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-sky-950/30">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-bold">ثبت‌نام در اجاره‌بان</h1>
          <p className="text-sm text-muted-foreground">
            یک حساب کاربری بسازید تا اجاره دهید یا اجاره بگیرید.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">نام</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">نام خانوادگی</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="username">نام کاربری</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setField('username', e.target.value.toLowerCase())}
              required
              autoComplete="username"
              placeholder="مثلاً: ali_reza"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              فقط حروف انگلیسی، عدد و _ . - مجاز است.
            </p>
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              حداقل ۶ کاراکتر.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">تلفن (اختیاری)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => {
                setField('phone', e.target.value)
                if (fieldError) setFieldError(null)
              }}
              autoComplete="tel"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              اختیاری — موبایل ایران، مثلاً ۰۹۱۲۳۴۵۶۷۸۹
            </p>
            {fieldError && (
              <p className="text-xs text-rose-600" role="alert">
                {fieldError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">شهر</Label>
            <select
              id="city"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="col-span-2 gap-2"
          >
            <UserPlus className="size-4" />
            {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          از قبل حساب دارید؟{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            وارد شوید
          </Link>
        </div>
      </div>
    </div>
  )
}
