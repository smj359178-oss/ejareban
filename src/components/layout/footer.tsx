'use client'

import { ShieldCheck, Headset, BadgeCheck, Truck } from 'lucide-react'
import { BrandMark } from '@/components/shared/brand-mark'
import { useNav } from '@/lib/store'

const TRUST = [
  { icon: ShieldCheck, label: 'ودیعه امن' },
  { icon: BadgeCheck, label: 'مالکان تأییدشده' },
  { icon: Truck, label: 'تحویل یا مراجعه' },
  { icon: Headset, label: 'پشتیبانی ۲۴/۷' },
]

export function Footer() {
  const go = useNav((s) => s.go)
  return (
    <footer className="mt-auto border-t bg-card/60">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-9" />
              <span className="text-xl font-extrabold tracking-tight">اجاره‌بان</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground text-pretty-fa">
              همراه اجارهٔ شما؛ پلتفرم امن اجاره در ایران.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">کاوش</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button onClick={() => go({ name: 'browse' })} className="transition-colors hover:text-primary">
                  همه آگهی‌ها
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'electronics' })} className="transition-colors hover:text-primary">
                  الکترونیک
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'cameras' })} className="transition-colors hover:text-primary">
                  دوربین
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'tools' })} className="transition-colors hover:text-primary">
                  ابزار
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">حساب کاربری</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button onClick={() => go({ name: 'dashboard' })} className="transition-colors hover:text-primary">
                  داشبورد من
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'dashboard', tab: 'bookings' })} className="transition-colors hover:text-primary">
                  رزروهای من
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'new-listing' })} className="transition-colors hover:text-primary">
                  ثبت آگهی
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'dashboard', tab: 'favorites' })} className="transition-colors hover:text-primary">
                  علاقه‌مندی‌ها
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">چرا اجاره‌بان؟</h4>
            <ul className="space-y-2.5 text-sm">
              {TRUST.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-muted-foreground">
                  <t.icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:text-right">
          <span>© {new Date().getFullYear()} اجاره‌بان. ساخته‌شده با Next.js 16 · Prisma · Tailwind.</span>
          <span className="flex items-center gap-3">
            <span>حریم خصوصی</span>
            <span>قوانین</span>
            <span>امنیت</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
