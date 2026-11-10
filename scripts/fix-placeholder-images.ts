/**
 * Replaces the branded placeholders (dead Unsplash IDs) with working photos
 * of the same category, re-encoded at the 1920px/q85 quality tier.
 *
 * Run: bun scripts/fix-placeholder-images.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT_DIR = join(process.cwd(), 'public', 'uploads', 'listings')

// Verified-working Unsplash photo IDs, chosen to match each listing's subject.
const REPLACEMENTS: Array<{ file: string; unsplashId: string }> = [
  { file: '1500634245200-758d746c1c14.webp', unsplashId: '1510127034890-ba27508e71f1' }, // Sony camera → DSLR body
  { file: '1572981779307-09b8d0150c2a.webp', unsplashId: '1504148455328-c376907d081c' }, // Bosch drill → power tools
  { file: '1607498284476-9b3b6c8e2f1c.webp', unsplashId: '1426927698958-b151889444c8' }, // Kärcher K5 → pressure washing
  { file: '1608043152269-f4cd465aa6fd.webp', unsplashId: '1470225620780-dba8ba36b745' }, // JBL PartyBox → DJ/speaker
  { file: '1593508512255-86ab6a878cf0.webp', unsplashId: '1622979135225-d2ba269cf1ac' }, // Quest 3 → VR headset (fallback in list)
  { file: '1504280390367-361c166d5500.webp', unsplashId: '1531058020387-3be344556be6' }, // Camping tent → outdoor/event
]

async function tryFetch(id: string): Promise<Buffer | null> {
  for (const url of [
    `https://images.unsplash.com/photo-${id}?w=1920&q=85&fm=jpg`,
    `https://images.unsplash.com/photo-${id}?w=1200&q=80&fm=jpg`,
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 1000) return buf
      }
    } catch { /* next */ }
  }
  return null
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const { file, unsplashId } of REPLACEMENTS) {
    const raw = await tryFetch(unsplashId)
    if (!raw) {
      console.log(`  ✗ ${file}: replacement ${unsplashId} unavailable, keeping placeholder`)
      continue
    }
    const buf = await sharp(raw)
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 5, smartSubsample: true })
      .toBuffer()
    await writeFile(join(OUT_DIR, file), buf)
    console.log(`  ✓ ${file} ← ${unsplashId} (${Math.round(buf.length / 1024)} KB)`)
  }
  process.exit(0)
}

main()
