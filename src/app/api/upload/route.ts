
import { NextResponse } from 'next/server'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'listings')
const MAX_FILE_BYTES = 10 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
])

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json(
      { error: 'درخواست غیرمجاز است.' },
      { status: 403 },
    )
  }

  const { user } = await getSession(req)

  if (!user) {
    return NextResponse.json(
      { error: 'برای آپلود عکس باید وارد شوید.' },
      { status: 401 },
    )
  }

  const rl = checkRateLimit(req, 'upload', `user:${user.id}`)
  if (!rl.ok) return rl.response

  const form = await req.formData().catch(() => null)

  if (!form) {
    return NextResponse.json(
      { error: 'داده‌های ارسالی نامعتبر است.' },
      { status: 400 },
    )
  }

  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'فایلی به نام file ارسال نشده است.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `حجم فایل بیشتر از ۱۰ مگابایت است (${(
          file.size /
          1024 /
          1024
        ).toFixed(1)} MB).`,
      },
      { status: 413 },
    )
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `نوع فایل مجاز نیست: ${file.type || 'نامشخص'}` },
      { status: 415 },
    )
  }

  await mkdir(UPLOAD_DIR, { recursive: true })

  const buf = Buffer.from(await file.arrayBuffer())
  const outName = `${randomUUID()}.webp`
  const outPath = join(UPLOAD_DIR, outName)

  try {
    await sharp(buf)
      .rotate()
      .toColourspace('srgb')
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 5, smartSubsample: true })
      .toFile(outPath)
  } catch (e) {
    console.error('Sharp image processing error:', e)

    return NextResponse.json(
      {
        error: `پردازش تصویر ناموفق بود: ${
          e instanceof Error ? e.message : 'خطای ناشناخته'
        }`,
      },
      { status: 422 },
    )
  }

  const finalSize = (await stat(outPath)).size

  return NextResponse.json({
    url: `/uploads/listings/${outName}`,
    bytes: finalSize,
  })
}