'use client'

import * as React from 'react'
import { ChevronLeft, ImagePlus, Sparkles, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNav } from '@/lib/store'
import { useSession } from '@/hooks/use-session'
import { useFetch } from '@/hooks/use-fetch'
import { CITIES, CONDITION_LABELS } from '@/lib/constants'
import type { CategoryDTO, ItemCondition } from '@/lib/types'
import { formatToman } from '@/lib/format'
import { toPersianDigits } from '@/lib/persian'

const CONDITIONS: ItemCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']

/**
 * NewListingView — a real create-listing form.
 *
 * - Authenticated: if the user is not logged in, we prompt them to log in.
 * - Image upload: drag/drop or click to pick local images; they are POSTed
 *   one by one to /api/upload which optimizes them with sharp and stores
 *   them under public/uploads/listings. The returned relative URL is what
 *   we send to /api/listings on submit.
 * - On submit, we POST to /api/listings which creates the row in PENDING
 *   moderation status. Admin approval is required before it goes public.
 */
export function NewListingView() {
  const back = useNav((s) => s.back)
  const go = useNav((s) => s.go)
  const notify = useNav((s) => s.notify)
  const { user } = useSession()
  const { data: catData } = useFetch<{ categories: CategoryDTO[] }>(
    '/api/categories',
  )
  const categories = catData?.categories ?? []

  const [form, setForm] = React.useState<{
    title: string
    description: string
    categoryId: string
    condition: ItemCondition
    brand: string
    model: string
    city: string
    dailyPrice: string
    weeklyPrice: string
    monthlyPrice: string
    deposit: string
    minRentalDays: string
    maxRentalDays: string
    deliveryAvailable: boolean
    deliveryFee: string
    images: string[]
  }>({
    title: '',
    description: '',
    categoryId: '',
    condition: 'GOOD',
    brand: '',
    model: '',
    city: CITIES[0],
    dailyPrice: '',
    weeklyPrice: '',
    monthlyPrice: '',
    deposit: '',
    minRentalDays: '1',
    maxRentalDays: '30',
    deliveryAvailable: true,
    deliveryFee: '120000',
    images: [],
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [uploadingCount, setUploadingCount] = React.useState(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Image upload: pick files, POST each one to /api/upload, collect the
  // returned relative URLs into form.images.
  //
  // Counting fix (bugs 21+22): the counter is incremented by ONE per call
  // (not per file × N) and decremented exactly once in `finally`, so it
  // always returns to 0. Images are appended with a functional setState so
  // multi-file uploads never lose results to a stale closure.
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (form.images.length + files.length > 8) {
      notify('حداکثر ۸ تصویر مجاز است.', 'error')
      return
    }
    setUploadingCount((n) => n + 1)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          notify(`فقط تصویر مجاز است: ${file.name}`, 'error')
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          notify(`فایل بزرگ‌تر از ۱۰ مگابایت: ${file.name}`, 'error')
          continue
        }
        try {
          const fd = new FormData()
          fd.append('file', file)
          const r = await fetch('/api/upload', { method: 'POST', body: fd })
          const data = await r.json().catch(() => null)
          if (!r.ok) {
            notify(data?.error ?? 'آپلود ناموفق بود', 'error')
            continue
          }
          // Functional update — never read form.images from the stale closure.
          setForm((f) => ({ ...f, images: [...f.images, data.url] }))
        } catch {
          notify(`اتصال به سرور ناموفق بود: ${file.name}`, 'error')
        }
      }
    } finally {
      setUploadingCount((n) => Math.max(0, n - 1))
      // Reset the input so the same file can be picked again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeImage(i: number) {
    set(
      'images',
      form.images.filter((_, idx) => idx !== i),
    )
  }

  async function submit() {
    if (!user) {
      notify('برای ثبت آگهی باید وارد شوید.', 'error')
      return
    }
    if (!form.title || !form.categoryId || !form.dailyPrice || !form.deposit) {
      notify('لطفاً همه فیلدهای الزامی را پر کنید', 'error')
      return
    }
    if (form.images.length === 0) {
      notify('حداقل یک تصویر آپلود کنید.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || 'بدون توضیحات اضافی.',
          categoryId: form.categoryId,
          condition: form.condition,
          brand: form.brand || undefined,
          model: form.model || undefined,
          city: form.city,
          dailyPrice: Number(form.dailyPrice),
          weeklyPrice: form.weeklyPrice ? Number(form.weeklyPrice) : undefined,
          monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined,
          deposit: Number(form.deposit),
          minRentalDays: Number(form.minRentalDays),
          maxRentalDays: Number(form.maxRentalDays) || undefined,
          deliveryAvailable: form.deliveryAvailable,
          deliveryFee: Number(form.deliveryFee),
          images: form.images,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        notify(data?.error ?? 'ثبت آگهی ناموفق بود', 'error')
        return
      }
      notify('آگهی ثبت شد! در صف تأیید مدیر قرار گرفت.', 'success')
      go({ name: 'dashboard', tab: 'listings' })
    } catch {
      notify('اتصال به سرور ناموفق بود', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const weeklyDiscount =
    form.dailyPrice && form.weeklyPrice
      ? Math.max(
          0,
          Math.round(
            (1 - Number(form.weeklyPrice) / (Number(form.dailyPrice) * 7)) * 100,
          ),
        )
      : 0

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-xl font-bold">برای ثبت آگهی وارد شوید</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          برای ثبت آگهی اجاره‌ای ابتدا باید وارد حساب کاربری خود شوید.
        </p>
        <Button asChild className="mt-5">
          <a href="/login">ورود به حساب</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={back}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl-flip" /> بازگشت
      </button>
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">ثبت آگهی اجاره</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        فرم ثبت آگهی اجاره. فیلدهای الزامی با * مشخص شده‌اند.
      </p>

      <Card className="mt-5">
        <CardContent className="space-y-5 p-5">
          {/* Images */}
          <div>
            <Label className="mb-2 block">تصاویر *</Label>
            <div className="flex flex-wrap gap-2">
              {form.images.map((img, i) => (
                <div
                  key={i}
                  className="relative size-20 overflow-hidden rounded-lg border bg-muted"
                >
                  <Image
                    src={img}
                    alt={`تصویر ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute left-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black/90"
                    aria-label="حذف تصویر"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <label
                className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFiles(e.dataTransfer.files)
                }}
              >
                {uploadingCount > 0 ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
                <span>{uploadingCount > 0 ? 'در حال آپلود…' : 'افزودن'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              تصاویر با بالاترین کیفیت (تا ۱۹۲۰ پیکسل، WebP سریع) بهینه و ذخیره می‌شوند.
            </p>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">عنوان *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="مثلاً مک‌بوک پرو ۱۴"
              className="mt-1.5"
            />
          </div>

          {/* Category + condition */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>دسته‌بندی *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => set('categoryId', v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="انتخاب دسته" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>وضعیت</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => set('condition', v as ItemCondition)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CONDITION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brand / model */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>برند</Label>
              <Input
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="مثلاً اپل"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>مدل</Label>
              <Input
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="مثلاً مک‌بوک پرو ۱۴"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="desc">توضیحات</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="وضعیت کالا، ملزومات، شرایط اجاره…"
              className="mt-1.5"
            />
          </div>

          {/* City */}
          <div>
            <Label>شهر *</Label>
            <Select value={form.city} onValueChange={(v) => set('city', v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">نرخ‌های اجاره *</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="text-xs">قیمت روزانه (تومان)</Label>
                <Input
                  type="number"
                  value={form.dailyPrice}
                  onChange={(e) => set('dailyPrice', e.target.value)}
                  placeholder="۸۵۰۰۰۰"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">قیمت هفتگی (اختیاری)</Label>
                <Input
                  type="number"
                  value={form.weeklyPrice}
                  onChange={(e) => set('weeklyPrice', e.target.value)}
                  placeholder="۴۸۰۰۰۰۰"
                  className="mt-1"
                />
                {weeklyDiscount > 0 && (
                  <Badge className="mt-1 bg-emerald-600 text-white">
                    {toPersianDigits(weeklyDiscount)}٪ تخفیف نسبت به روزانه
                  </Badge>
                )}
              </div>
              <div>
                <Label className="text-xs">قیمت ماهانه (اختیاری)</Label>
                <Input
                  type="number"
                  value={form.monthlyPrice}
                  onChange={(e) => set('monthlyPrice', e.target.value)}
                  placeholder="۱۶۵۰۰۰۰۰"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">ودیعه (تومان)</Label>
                <Input
                  type="number"
                  value={form.deposit}
                  onChange={(e) => set('deposit', e.target.value)}
                  placeholder="۸۰۰۰۰۰۰"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">حداقل روز</Label>
                  <Input
                    type="number"
                    value={form.minRentalDays}
                    onChange={(e) => set('minRentalDays', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">حداکثر روز</Label>
                  <Input
                    type="number"
                    value={form.maxRentalDays}
                    onChange={(e) => set('maxRentalDays', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            {form.dailyPrice && (
              <p className="mt-3 text-xs text-muted-foreground">
                مثال: اجاره {toPersianDigits(5)} روزه = {formatToman(Number(form.dailyPrice) * 5)}
                {form.deposit
                  ? ` + ${formatToman(Number(form.deposit))} ودیعه`
                  : ''}
              </p>
            )}
          </div>

          {/* Delivery */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.deliveryAvailable}
              onChange={(e) => set('deliveryAvailable', e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span className="text-sm">ارسال توسط مالک (مالک کالا را می‌آورد)</span>
          </label>
          {form.deliveryAvailable && (
            <div>
              <Label>هزینه ارسال (تومان)</Label>
              <Input
                type="number"
                value={form.deliveryFee}
                onChange={(e) => set('deliveryFee', e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              آگهی‌های جدید قبل از انتشار وارد صف تأیید می‌شوند.
            </p>
            <Button onClick={submit} disabled={submitting || uploadingCount > 0}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> در حال ذخیره…
                </>
              ) : (
                'انتشار آگهی'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
