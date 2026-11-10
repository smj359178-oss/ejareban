import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin } from '@/lib/http'
import { toEnglishDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'

const RegisterSchema = z.object({
  // The customer's full name and login handle. We accept Persian or English.
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, digits, _ . -'),
  email: z.string().email().max(120),
  password: z.string().min(6).max(200),
  phone: z.string().max(20).optional(),
  city: z.string().max(60).optional(),
})

/**
 * Normalize an Iranian mobile number (bug 15).
 *
 *  - Persian/Arabic digits → English digits
 *  - strip spaces, dashes and parentheses
 *  - empty input → null (NULL never collides with the unique index;
 *    storing '' did — that was the "phone already taken for everyone" bug)
 *  - accept +98 / 0098 / 0 prefixes → normalized to `09xxxxxxxxx`
 *
 * Returns { ok: true, phone } or { ok: false } when the format is invalid.
 */
function normalizePhone(raw: string | undefined): { ok: true; phone: string | null } | { ok: false } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { ok: true, phone: null }

  const digits = toEnglishDigits(trimmed).replace(/[\s\-().]/g, '')
  if (!/^(\+98|0098|0)?9\d{9}$/.test(digits)) return { ok: false }
  // Keep the canonical local form: 09xxxxxxxxx
  return { ok: true, phone: `0${digits.slice(-10)}` }
}

/**
 * POST /api/auth/register
 *
 * Body: { firstName, lastName, username, email, password, phone?, city? }
 *
 * Creates a new USER-role account, hashes the password with bcrypt, and
 * immediately logs the user in by setting the session cookie (HMAC-signed).
 *
 * Uniqueness is enforced by the database. The pre-flight check gives clean
 * messages for email/username, and the Prisma P2002 catch covers races and
 * the unique `phone` column (empty phones are stored as NULL so they never
 * collide — the user-reported registration blocker).
 */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: 'درخواست غیرمجاز است.' }, { status: 403 })
  }

  // Anti-abuse: dedicated register bucket (5/hour per IP) — must NOT consume
  // login quota (bug 2).
  const rl = checkRateLimit(req, 'register')
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'اطلاعات وارد شده معتبر نیست.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { firstName, lastName, username, email, password, phone, city } = parsed.data

  // Phone normalization / validation (bug 15)
  const phoneResult = normalizePhone(phone)
  if (!phoneResult.ok) {
    return NextResponse.json(
      { error: 'شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹' },
      { status: 400 },
    )
  }

  // Pre-flight uniqueness check (the DB also enforces, but we want a clean
  // error message before sending the create query).
  const usernameLower = username.toLowerCase()
  const emailLower = email.toLowerCase()

  const existing = await db.user.findFirst({
    where: {
      OR: [{ email: emailLower }, { username: usernameLower }],
    },
    select: { id: true, email: true, username: true },
  })
  if (existing) {
    if (existing.email === emailLower) {
      return NextResponse.json(
        { error: 'این ایمیل قبلاً ثبت شده است.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'این نام کاربری قبلاً گرفته شده است.' },
      { status: 409 },
    )
  }

  let user
  try {
    user = await db.user.create({
      data: {
        email: emailLower,
        username: usernameLower,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        passwordHash: await hashPassword(password),
        role: 'USER',
        phone: phoneResult.phone,
        city: city ?? null,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          firstName + ' ' + lastName,
        )}&backgroundColor=10b981,0ea5e9,6366f1,ec4899`,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        isIdentityVerified: true,
        trustScore: true,
      },
    })
  } catch (e) {
    // Unique-violation race (or phone collision) → per-field Persian message.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const rawTarget = (e.meta as { target?: unknown } | undefined)?.target
      const targets: string[] = Array.isArray(rawTarget)
        ? rawTarget.map(String)
        : typeof rawTarget === 'string'
          ? [rawTarget]
          : []
      if (targets.includes('email')) {
        return NextResponse.json(
          { error: 'این ایمیل قبلاً ثبت شده است.' },
          { status: 409 },
        )
      }
      if (targets.includes('username')) {
        return NextResponse.json(
          { error: 'این نام کاربری قبلاً گرفته شده است.' },
          { status: 409 },
        )
      }
      if (targets.includes('phone')) {
        return NextResponse.json(
          { error: 'این شماره موبایل قبلاً ثبت شده است.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: 'این اطلاعات قبلاً ثبت شده است.' },
        { status: 409 },
      )
    }
    throw e
  }

  const res = NextResponse.json({ user }, { status: 201 })
  res.headers.set('Set-Cookie', setSessionCookie(user.id))
  return res
}
