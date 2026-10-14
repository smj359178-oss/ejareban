/**
 * Restores the seeded listing photos referenced by the database.
 *
 * The seed stores local paths like /uploads/listings/<unsplash-id>.webp but
 * the binary files were not included in the project archive. This script
 * re-downloads each photo from Unsplash at the highest quality tier used by
 * the upload API (1920px, WebP q85) and writes it to public/uploads/listings.
 * IDs that are no longer available on Unsplash fall back to a branded
 * placeholder so the UI never shows a broken image.
 *
 * Run: bun scripts/restore-seed-images.ts
 */
import { PrismaClient } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const db = new PrismaClient()
const OUT_DIR = join(process.cwd(), 'public', 'uploads', 'listings')

async function fetchPhoto(id: string): Promise<Buffer | null> {
  const candidates = [
    `https://images.unsplash.com/photo-${id}?w=1920&q=85&fm=jpg`,
    `https://images.unsplash.com/photo-${id}?w=1200&q=80&fm=jpg`,
    `https://images.unsplash.com/photo-${id}`,
  ]
  for (const url of candidates) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 1000) return buf
      }
    } catch {
      /* try next candidate */
    }
  }
  return null
}

async function placeholder(): Promise<Buffer> {
  const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#0d9488"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <circle cx="600" cy="360" r="110" fill="rgba(255,255,255,0.15)"/>
    <text x="600" y="600" font-size="52" font-weight="bold" text-anchor="middle" fill="#ffffff">اجاره‌بان</text>
  </svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const listings = await db.listing.findMany({ select: { id: true, title: true, images: true } })
  const needed = new Set<string>()
  for (const l of listings) {
    try {
      const arr = JSON.parse(l.images || '[]') as string[]
      for (const src of arr) {
        const m = src.match(/\/uploads\/listings\/([^/]+\.webp)$/)
        if (m) needed.add(m[1])
      }
    } catch { /* ignore */ }
  }

  console.log(`Photos referenced: ${needed.size}`)
  let ok = 0, fallback = 0, skipped = 0

  for (const file of needed) {
    const outPath = join(OUT_DIR, file)
    if (existsSync(outPath)) { skipped++; continue }
    const photoId = file.replace(/\.webp$/, '')
    const raw = await fetchPhoto(photoId)
    let buf: Buffer
    if (raw) {
      buf = await sharp(raw)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 5, smartSubsample: true })
        .toBuffer()
      ok++
      console.log(`  ✓ ${file} (${Math.round(buf.length / 1024)} KB)`)
    } else {
      buf = await placeholder()
      fallback++
      console.log(`  ⚠ ${file} → branded placeholder (source unavailable)`)
    }
    await writeFile(outPath, buf)
  }

  console.log(`Done. downloaded=${ok} placeholder=${fallback} already-present=${skipped}`)
  process.exit(0)
}

main()
