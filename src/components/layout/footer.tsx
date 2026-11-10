'use client'

import Image from 'next/image'
import { ShieldCheck, Headset, BadgeCheck, Truck } from 'lucide-react'
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
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <Image
                src="/brand/logo-mark.png"
                alt="اجاره‌بان"
                width={32}
                height={32}
                className="size-8 rounded-lg"
              />
              <span className="text-lg font-bold tracking-tight">اجاره‌بان</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground text-pretty-fa">
              بانای اجارهٔ شما. پلتفرم امن اجاره در ایران.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">کاوش</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button onClick={() => go({ name: 'browse' })} className="transition-colors hover:text-foreground">
                  همه آگهی‌ها
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'electronics' })} className="transition-colors hover:text-foreground">
                  الکترونیک
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'cameras' })} className="transition-colors hover:text-foreground">
                  دوربین
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'browse', categorySlug: 'tools' })} className="transition-colors hover:text-foreground">
                  ابزار
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">حساب کاربری</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button onClick={() => go({ name: 'dashboard' })} className="transition-colors hover:text-foreground">
                  داشبورد من
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'dashboard', tab: 'bookings' })} className="transition-colors hover:text-foreground">
                  رزروهای من
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'new-listing' })} className="transition-colors hover:text-foreground">
                  ثبت آگهی
                </button>
              </li>
              <li>
                <button onClick={() => go({ name: 'dashboard', tab: 'favorites' })} className="transition-colors hover:text-foreground">
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

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
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
