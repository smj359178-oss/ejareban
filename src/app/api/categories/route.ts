import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapCategory } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cats = await db.category.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ categories: cats.map(mapCategory) })
}
