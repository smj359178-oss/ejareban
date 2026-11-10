# Ejareban — Bug-Fix Council Worklog

Project: اجاره‌بان (Ejareban) — Persian rental marketplace, Next.js 16 + Prisma/SQLite.

## Master Bug List (from full code audit)

### A. Security & Throttling (user-reported: "تعداد ریکوئست زیاد میشد اجازه ورود نمیداد", "یک بار رمز اشتباه = هک کننده")
1. `src/lib/rate-limit.ts` + `src/app/api/auth/login/route.ts`: login rate limit counts EVERY attempt (success or fail) at 5/15min keyed by IP only → legit users locked out (all sandbox IPs are `unknown`). FIX: only count FAILED attempts, key by `ip+identifier`, success resets counter, higher generous limits, bucket cleanup (memory leak).
2. Register shares the same `auth` bucket as login (register consumes login quota). FIX: separate buckets.
3. `search` limit 30/min per IP too low for normal browsing (home fetches 3 endpoints at once). FIX: raise to 120/min, key by user id when logged in.
4. Upload route reuses `search` config. FIX: dedicated `upload` bucket.
5. **CRITICAL**: session cookie = raw user id (`ejareban-user=<cuid>`) → anyone can forge cookie and become ADMIN. FIX: HMAC-signed token (`userId.hmac`) in `src/lib/auth.ts` with server secret.
6. No Origin check on mutations → CSRF possible. FIX: `assertSameOrigin(req)` helper used by all mutating routes.
7. ReportForm in listing-view only does `fetch(..., {method:'OPTIONS'})` — reports never saved. FIX: real `POST /api/reports` endpoint (auth) + wire UI.
8. Reviews: any logged-in user can review any listing without ever renting it. FIX: require a COMPLETED booking where reviewer is the renter.
9. `/api/listings/[slug]` increments views for every request incl. owner. FIX: skip when viewer is owner.
10. Booking PATCH notifications in English; booking errors in English ('Unauthorized', 'Listing unavailable', 'You cannot book your own listing', 'Minimum rental is X day(s)') → all Persian + specific.
11. Booking POST transaction: non-CONFLICT errors rethrown as raw 500. FIX: catch + Persian 500 message.

### B. Privacy (user-reported: guests must not see owner info / address / dates)
12. `mapListing` (src/lib/mappers.ts) returns `owner.id/name/avatar/createdAt`, `address`, `lat`, `lng` to EVERYONE incl. anonymous. FIX: viewer-aware sanitization — for anonymous: owner masked (name null + verified flag only), address/lat/lng null; for logged-in non-owner: keep name/avatar (needed for chat) but mask exact address/lat/lng unless owner/admin.
13. UI (listing-view) must reflect: guests see NO owner card (login CTA instead), NO booking calendar (login CTA), NO address.
14. Guests clicking «ذخیره» (favorite) / «پیام» / «گزارش» silently fail → login prompts.

### C. Registration / phone bug (user-reported: "شماره تلفن قبلا انتخاب شده و بقیه نمی‌توانند ثبت‌نام کنند")
15. `phone` is `@unique` in schema; register stores `phone: ''` (empty string) instead of null → 2nd user with empty phone hits unique violation → 500. FIX: normalize empty/invalid phone → null; validate Iranian mobile format `09xxxxxxxxx` (digits normalized fa→en); catch P2002 per-field with Persian messages for email/username/phone.

### D. UI junk (user-reported)
16. Homepage `DownloadBanner` («دانلود کامل کد منبع پروژه ZIP») — REMOVE + delete `src/app/api/download/route.ts` + remove navbar «دانلود پروژه» button.
17. Navbar dropdown «مشاهده API» (`/api/listings?limit=4`) — REMOVE.
18. Hero floating featured cards (home-view left side): staggered `mt-8` + inconsistent look — user complaint. Make uniform aligned grid.

### E. Business logic (user-reported: "چرا خود طرف میتونه جنس خودشو اجاره کنه")
19. Owner CAN see booking calendar on own listing and book it (API blocks with English msg). FIX: listing-view shows "این آگهی متعلق به شماست" management panel instead of calendar for owner.
20. Image upload quality (user-reported: "کیفیت خوبی نداره"): upload route resizes to 1200px q80. FIX: 1920px longest side, WebP quality 85 + effort 6, smartSubsample; add long-cache immutable headers for `/uploads/*` in next.config.ts for speed.
21. new-listing-view `uploadingCount` bug: adds `files.length` but decrements 1 → spinner stuck → submit disabled forever. FIX.
22. new-listing-view stale-closure bug: multi-file upload keeps only LAST image (`[...form.images, url]` reads stale state). FIX with functional setState.
23. Dashboard accessible to guests → raw 401s. FIX: login gate like new-listing-view.
24. Dashboard `BOOKING_STATUS_LABELS_FA` wrong grammar («در حال اجاره شد»); use central status meta.
25. Empty-review text says "اولین نفر باشید" but only renters of completed bookings can review — fix copy.
26. Admin panel: notify('عملیات ناموفق') without reading server error detail — minor, improve.

### F. Schema
27. `prisma/schema.prisma` line 143: `@@index(oderationStatus])` typo → `@@index([moderationStatus])` (db push still passed but index broken/meaningless).

### G. Design (user-reported: homepage product sizes inconsistent)
28. See designer task below.

### H. SEO
29. Metadata OK at root; missing viewport export, per-view titles impossible (SPA) — verify robots.ts/sitemap.ts quality, JSON-LD, alt texts.

## Council Assignments
- **Task 2-a** (backend-security agent): items 1–15, 19-API-part, 20-API-part, 27 — files: `src/lib/**`, `src/app/api/**`, `prisma/schema.prisma`, `next.config.ts`.
- **Task 2-b** (frontend agent): items 10-UI, 12-UI, 13, 14, 16, 17, 18, 19-UI, 20-UI hint, 21, 22, 23, 24, 25, 26 — files: `src/components/**`, `src/hooks/**`, `src/app/page.tsx`, `src/app/login`, `src/app/register`.
- **Task 3-a** (designer): full visual review + polish after 2-b lands.
- **Task 3-b** (SEO engineer): SEO review after 2-a lands.
- **Task 4** (lead/QA): db push, E2E as admin/renter/guest, final zip.

## Rules for all agents
- READ this file first. APPEND your section when done (never overwrite).
- Do not run `bun run build`. Lint with `bun run lint` (scoped to your files).
- Persian UI copy, no English user-facing strings.
- Do not create new routes/pages — single-page app via `useNav` views only.

---
Task ID: 2-a
Agent: backend-security-engineer
Task: Backend & security fixes — bugs 1–9, 10+11 (API), 12 (server enforcement), 15, 19-API, 20-API, 27 + CSRF origin checks + Persian API errors.

Work Log:
- rate-limit.ts redesigned (bugs 1+2+3+4): only FAILED logins are punished. Kept `rateLimit(key, opts)` / `checkRateLimit()` / `getClientIP()` signatures; added `clearRateLimit(key)` and bucket sweeping (lazy piggy-back + unref'd setInterval, both throttled to ~10 min) so the Map can't grow unbounded. New RATE_LIMITS: auth 20/15min per IP (broad), authFail 8/15min per `ip:identifier` (failed logins only), register 5/hour (own bucket — no longer eats login quota), createBooking 20/10min, createReview 10/10min, verify 5/hour, search 120/min, upload 60/min.
- login route: broad `auth` check → on FAILED auth consumes one `authFail` token keyed `${ip}:${identifierLower}`; bucket exhausted → 429 «به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً برای این حساب مسدود شده است. ۱۵ دقیقه دیگر دوباره تلاش کنید.»; on SUCCESS `clearRateLimit` resets the fail counter. Successful logins are never throttled by the fail bucket.
- CRITICAL session forgery fixed (bug 5) in auth.ts: cookie now stores HMAC-signed token `userId.hmacSHA256(userId, SESSION_SECRET)` (node:crypto, timing-safe compare). `signSessionToken`/`verifySessionToken` added; `getSession` verifies the HMAC BEFORE the DB lookup (invalid → null user, no DB hit). `setSessionCookie` stores the signed value; same exported API otherwise. .env.example created with DATABASE_URL + documented SESSION_SECRET (dev fallback constant in auth.ts; production must set the env var). NOTE: old raw-id cookies are now invalid → all existing sessions log out once.
- CSRF/Origin checks (bug 6): new `src/lib/http.ts` `assertSameOrigin(req)` — compares `Origin` host against `Host`/`x-forwarded-host`; missing Origin = allowed (non-browser). Applied to EVERY POST/PATCH/DELETE handler: auth/login, auth/register, auth/logout, listings POST, upload, favorites POST+DELETE, reviews, bookings POST, bookings/[id] PATCH, chat/conversations POST, chat/[conversationId] POST, new /api/reports, admin listings/[id] PATCH, admin reports PATCH, admin verifications/[id] PATCH. Mismatch → 403 «درخواست غیرمجاز است.» GET routes untouched.
- Privacy server-side (bug 12): `mapListing(listing, viewer?)` with `viewer = { userId?, isAdmin? } | null` (documented policy block in mappers.ts). Anonymous → owner masked to `{ id: '', name: null, avatar: null, trustScore: 0, rating: 0, ratingCount, isIdentityVerified, createdAt }` and address/lat/lng nulled. Logged-in non-owner → owner id/name/avatar kept (chat needs them), address/lat/lng still nulled. Owner/admin → full. All call sites pass the session-resolved viewer: listings GET+POST, listings/[slug] GET, favorites ?detail=1, admin listings GET + moderation PATCH. ListingDTO owner.name widened to `string | null` (id stays string).
- Real reports endpoint (bug 7): new `src/app/api/reports/route.ts` POST — auth + Origin + 5/10min per user; validates reason enum (spam|scam|inappropriate|duplicate|other) and listing existence; creates Report(status OPEN); returns 201 {ok:true}.
- Reviews integrity (bug 8): POST now requires a COMPLETED booking on that listing with renterId = user.id, else 403 «فقط کاربرانی که این کالا را اجاره گرفته و بازگردانده‌اند می‌توانند نظر ثبت کنند.»; duplicate-review message → «شما قبلاً برای این آگهی نظر ثبت کرده‌اید.»
- View counter (bug 9): /api/listings/[slug] resolves session first and skips the view increment when viewer IS the owner. Response shape unchanged.
- Bookings Persian + robust (bugs 10+11): all errors Persian and specific — «برای رزرو باید وارد شوید.», «این آگهی در حال حاضر قابل رزرو نیست.», «نمی‌توانید کالای خودتان را اجاره بگیرید.», «بازهٔ تاریخ نامعتبر است.», «حداقل مدت اجاره ۳ روز است.» / «حداکثر مدت اجاره X روز است.» (Persian digits), 409 conflict text kept, transaction wrapped: non-CONFLICT errors log server-side and return 500 «خطای غیرمنتظره در سرور. لطفاً دوباره تلاش کنید.» Notifications now Persian: «رزرو شما تأیید شد» / «رزرو شما رد شد» / «رزرو شما لغو شد» with body «رزرو شما برای "X" … شد.», admin moderation → «آگهی شما تأیید شد» / «آگهی شما رد شد» (+دلیل), verifications → «هویت شما تأیید شد» / «درخواست احراز هویت رد شد».
- Phone normalization (bug 15) in register: fa/ar digits → en (toEnglishDigits), strips spaces/dashes/parens, empty → null, validates `^(\+98|0098|0)?9\d{9}$` → canonical `09xxxxxxxxx` else 400 «شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹». `db.user.create` wrapped in try/catch for Prisma P2002 with per-target messages: email → «این ایمیل قبلاً ثبت شده است.», username → «این نام کاربری قبلاً گرفته شده است.», phone → «این شماره موبایل قبلاً ثبت شده است.». 'Invalid input' → «اطلاعات وارد شده معتبر نیست.» (+issues) everywhere.
- Schema (bug 27): line 143 verified at byte level (od -c) to be `@@index([moderationStatus])` — the typo is NOT present in the current file (it was a bash-output display artifact: the output pipeline swallows literal `[m` — beware when grepping for bracketed tokens). No change required; file untouched.
- Upload (bug 20-API): dedicated `upload` bucket (60/min per user, no longer borrows `search`); sharp resize {width:1920,height:1920,fit:'inside',withoutEnlargement:true} + .webp({quality:85, effort:5, smartSubsample:true}); 10MB limit kept. next.config.ts: immutable long-cache header `public, max-age=31536000, immutable` for `/uploads/:path*` (existing config preserved).
- Persian sweep of remaining API errors: listings/[slug] + availability 404s, bookings/[id] (401/404/403/transition), favorites (401/400), reviews GET 400, chat routes ('Unauthorized'→«برای استفاده از گفتگو باید وارد شوید.»/«برای ارسال پیام باید وارد شوید.», 'Forbidden'→«شما به این گفتگو دسترسی ندارید.», 'Cannot start a conversation with yourself'→«نمی‌توانید با خودتان گفتگو شروع کنید.», plus 'Conversation not found'/'Listing not found'/origin), contract PDF ('Unauthorized'/'Booking not found'/'Forbidden'), all admin routes 'Admin only'→«دسترسی فقط برای مدیر مجاز است.».
- Verification: `bunx tsc --noEmit` → ZERO errors in src/lib/** and src/app/api/**; `bun run lint` → clean. Runtime smoke test (bun -e): signed-token round-trip ✓, tampered/raw-id/empty tokens rejected ✓, fail-bucket blocks on 9th attempt and clearRateLimit resets ✓, assertSameOrigin same/cross/no-origin/forwarded-host ✓.

Stage Summary: All Task 2-a items (1–15, 19-API, 20-API, 27) implemented in src/lib/**, src/app/api/**, next.config.ts, .env.example. Sessions are now HMAC-signed and unforgeable; login throttling punishes only failures per-account; register/verify/upload/search have sane separate limits; every mutation is same-origin-checked; listing privacy (owner + address/lat/lng) is enforced server-side for guests; reports endpoint is real; reviews require completed rentals; owner views don't inflate counters; all API user-facing strings are Persian. Files touched: src/lib/{rate-limit,auth,http,mappers,types}.ts, src/app/api/** (auth/login, auth/register, auth/logout, listings, listings/[slug], listings/[slug]/availability, bookings, bookings/[id], bookings/[id]/contract, reviews, favorites, upload, reports (new), chat/*, admin/*), next.config.ts, .env.example. NOT touched (2-b scope): components, hooks, page.tsx, login/register pages. HANDOFF to 2-b below.

HANDOFF TO 2-b (frontend agent) — must-read:
1. BREAKING TYPE: ListingDTO.owner.name is now `string | null` (owner.id stays string but is `''` for guests). tsc error in YOUR file: src/components/views/listing-view.tsx:351 'listing.owner.name' is possibly 'null' — handle it (guests get a masked owner; show login CTA instead of owner card, per bug 13).
2. Guests (no session): /api/listings + /api/listings/[slug] return owner { id: '', name: null, avatar: null, trustScore: 0, rating: 0, ratingCount, isIdentityVerified, createdAt } and address/lat/lng = null. Logged-in non-owner: owner id/name/avatar present, address/lat/lng still null. Owner/admin: full data.
3. All mutations now require same-origin (fetch from the app sends Origin — no client change needed; curl/tests without Origin also pass). CORS-style cross-host testing will 403 «درخواست غیرمجاز است.»
4. Old session cookies are invalidated by the HMAC change — users (and your dev browser) must log in again. Set SESSION_SECRET in .env to keep tokens stable across dev restarts (fallback constant otherwise).
5. Exact new Persian strings the UI may surface: 401 login-fail «نام کاربری یا رمز عبور اشتباه است.»; lockout 429 «به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً برای این حساب مسدود شده است. ۱۵ دقیقه دیگر دوباره تلاش کنید.»; register 409s «این ایمیل قبلاً ثبت شده است.» / «این نام کاربری قبلاً گرفته شده است.» / «این شماره موبایل قبلاً ثبت شده است.»; phone 400 «شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹»; generic validation «اطلاعات وارد شده معتبر نیست.»; booking errors as listed above; review gate «فقط کاربرانی که این کالا را اجاره گرفته و بازگردانده‌اند می‌توانند نظر ثبت کنند.»; review dup «شما قبلاً برای این آگهی نظر ثبت کرده‌اید.»; report success POST /api/reports → 201 {ok:true} (body {listingId, reason, description?}).
6. Rate limits now: search 120/min (keyed per logged-in user), upload 60/min, register 5/h, reports 5/10min, createBooking 20/10min, createReview 10/10min, auth 20/15min per IP + 8 fails/15min per account.
7. Upload response shape unchanged ({url, bytes}); images now 1920px WebP q85 + immutable caching — the "کیفیت" hint copy on your side can say max 1920px.

---
Task ID: 2-b-1
Agent: frontend-engineer-1
Task: Frontend gating fixes — bugs 13, 14 (listing-view + navbar + listing-card), 17, 19 (UI part) in listing-view.tsx / navbar.tsx / listing-card.tsx; types.ts verified.

Work Log:
- listing-view.tsx (bugs 13+14, TOP PRIORITY): owner card for guests replaced with compact locked-identity card (lucide ShieldOff in amber circle, «اطلاعات مالک برای مهمان‌ها پنهان است» / «برای مشاهدهٔ مالک، گفتگو و رزرو، وارد حساب خود شوید.» + «ورود به حساب» Button asChild → Link /login; same Card + CardContent p-5 pattern). Logged-in branch keeps full owner card but name is now `listing.owner.name ?? 'مالک'` and avatar fallback `(listing.owner.name ?? '؟')[0]` (tsc null fix from handoff item 1).
- listing-view.tsx (bug 13): right sticky column keeps the price + rating header; below it a 3-way branch: guest → locked-booking card («انتخاب تاریخ برای مهمان‌ها فعال نیست» / «برای انتخاب تاریخ و ثبت درخواست رزرو وارد شوید.» + full-width ورود به حساب Button → /login, CalendarClock + Lock icons; lucide-react 0.525.0 has NO CalendarLock — verified at runtime — so CalendarClock+Lock per spec fallback); owner → management card (bug 19); else → BookingCalendar as before.
- listing-view.tsx (bug 19): `const isOwner = !!user && user.id === listing.owner.id` (safe for guests since API masks owner id to ''); BookingCalendar replaced with management card: «این آگهی متعلق به شماست» + «به‌عنوان مالک نمی‌توانید کالای خودتان را اجاره بگیرید.» + «مدیریت آگهی‌ها» → `go({name:'dashboard', tab:'listings'})` and «آگهی جدید» → `go({name:'new-listing'})`. Heart/ذخیره button hidden for owner (`{!isOwner && ...}`); «پیام» button disabled simplified to `chatStarting || isOwner`.
- listing-view.tsx (bug 14): toggleFav now returns early with `notify('برای ذخیرهٔ آگهی ابتدا وارد شوید.', 'info')` when `!user` (no API call) — covers the top Heart/ذخیره click path. گزارش Dialog trigger rendered only when `user`; onOpenChange also guards (`o && !user` → notify «برای گزارش آگهی ابتدا وارد شوید.» and do not open). اشتراک‌گذاری left visible for everyone.
- listing-view.tsx: ProgressiveAddress — when `listing.address` is null (guests/non-owners per backend) a plain city line (MapPin + city) renders instead of the address element; revealed prop now uses isOwner || ADMIN.
- listing-view.tsx ReportForm: fake `fetch('/api/listings/'+id, {method:'OPTIONS'})` demo hack REPLACED with real `POST /api/reports` body `{listingId, reason, description: desc.trim() || undefined}`; ok → «گزارش شما ثبت شد. تیم پشتیبانی بررسی می‌کند.» + onClose(); !ok → `d.error ?? 'ثبت گزارش ناموفق بود'` as error toast; network catch → same error toast; new `submitting` state disables the button with «در حال ارسال…».
- listing-view.tsx reviews: reviewer name guards `(r.reviewer.name ?? '؟')[0]` for avatar fallback and `{r.reviewer.name ?? 'کاربر'}` for display; empty-reviews copy → «هنوز نظری ثبت نشده — نظرات فقط توسط اجاره‌گیرندگان واقعی ثبت می‌شود.»
- navbar.tsx (bug 14): helper renamed/generalized to `requireLogin(message, action)` (one local helper, keeps `loading` guard); «پیام‌ها» desktop+mobile → «برای مشاهدهٔ پیام‌ها ابتدا وارد شوید.»; «داشبورد» desktop+mobile → «برای مشاهدهٔ داشبورد ابتدا وارد شوید.»; both redirect `window.location.href = '/login'` for guests, else run existing openInbox()/go(dashboard) (+ close mobile sheet).
- navbar.tsx (bug 17): verified the «دانلود پروژه» `<a href="/api/download">` block and the «مشاهده API» DropdownMenuItem are ALREADY absent from current navbar.tsx (rg finds no «دانلود پروژه»/«مشاهده API»/api/download anywhere in src/). Imports checked: no Download/Repeat present; `Link` KEPT — still used by ورود به حساب/ثبت‌نام dropdown items. Nothing to remove; no changes made for 17.
- listing-card.tsx (bug 14): `useSession()` added alongside useNav; toggleFav: stopPropagation first, then `if (!user) { notify('برای ذخیرهٔ آگهی ابتدا وارد شوید.', 'info'); return }` before any favorites API call / favLoading flip.
- src/lib/types.ts: VERIFIED only — `ListingDTO.owner.name: string | null` already present (backend agent did it, comment block at lines 100–111); NO additive change required, file untouched.

Stage Summary: All assigned bugs done. Guests now see: locked-identity card instead of owner info, locked-booking card instead of the date calendar, city-only location line (no address), no گزارش trigger, and Persian login toasts for ذخیره (view + card) / پیام‌ها / داشبورد / گزارش. Owners see the «این آگهی متعلق به شماست» management panel instead of BookingCalendar and no favorite button on their own listing. Reports are really persisted via POST /api/reports with submitting state and Persian error surfacing. Reviewer-name null guards + new empty-reviews copy in place. Files changed: src/components/views/listing-view.tsx, src/components/layout/navbar.tsx, src/components/rental/listing-card.tsx. `bun run lint` → clean (no output); `bunx tsc --noEmit` filtered to src/components|src/lib (minus upload noise) → zero errors. All user-facing strings Persian. Did not run dev server/build. Handoff to 2-b-2 / QA: home-view DownloadBanner + new-listing-view upload bugs (21/22), dashboard gate (23), status labels (24), admin notify detail (26) remain with the other frontend agent.

---
Task ID: 2-b-2
Agent: frontend-engineer-2
Task: Frontend fixes batch 2 — BUG 16, 18 (home-view), 21+22 (new-listing upload), 23+24 (dashboard gate/status labels), 23+26 (admin gate/error toasts), 10-UI (booking-calendar errors), 1-UI (login lockout UX), 15 client (register phone). Files: home-view.tsx, new-listing-view.tsx, dashboard-view.tsx, admin-view.tsx, booking-calendar.tsx, login/page.tsx, register/page.tsx.

Work Log:
- BUG 16 + BUG 18 (home-view.tsx): VERIFIED already in the required end-state — no edit needed. Current file has no `DownloadBanner`, no `Download`/`Package` imports (grep across src confirms zero hits), no staggered `i % 2 === 1 && 'mt-8'`; hero featured block is `w-[28rem] grid-cols-2 gap-4` with 4 identical cards (aspect-[4/3] image box, p-2.5, line-clamp-1 title, price Badge `absolute right-2 top-2`, hover lift + shadow preserved). Appears to have been fixed before this run; recorded here so the lead knows both are done. No other file touched.
- BUG 21+22 (new-listing-view.tsx): `handleFiles` now increments `uploadingCount` by 1 per call (`n + 1`) and decrements exactly once in `finally` → counter always returns to 0, so the submit button's `disabled={submitting || uploadingCount > 0}` works correctly again. Image append switched from stale-closure `set('images', [...form.images, url])` to functional `setForm((f) => ({ ...f, images: [...f.images, data.url] }))` → multi-file uploads keep ALL images. Sequential per-file loop kept; per-file failures (bad type / >10MB / !ok with server Persian error / network throw) notify and continue; per-file fetch wrapped in try/catch (`r.json().catch(() => null)` too). Hint line updated to «تصاویر با بالاترین کیفیت (تا ۱۹۲۰ پیکسل، WebP سریع) بهینه و ذخیره می‌شوند.»
- BUG 23 (dashboard-view.tsx): `useSession().loading` → small centered spinner block («در حال بارگذاری…», Loader2); after load `!user` → login gate panel in new-listing-view style (LayoutDashboard icon, «برای مشاهدهٔ داشبورد وارد شوید», desc «رزروها، آگهی‌ها و علاقه‌مندی‌های شما اینجا نمایش داده می‌شود.», Button asChild → /login), max-w-md px-4 py-20 — tabs/bookings content never renders for guests. Bonus: all 4 dashboard useFetch calls now pass `user ? url : null`, so guests fire ZERO dashboard requests (no more raw 401s in console — root symptom of bug 23); useFetch(null) is a supported no-op and re-fetches when the session resolves.
- BUG 24 (dashboard-view.tsx): local `BOOKING_STATUS_LABELS_FA` deleted; act() toast uses `BOOKING_STATUS_META[status as keyof typeof BOOKING_STATUS_META]?.label ?? status` keeping the «رزرو X.» sentence (also fixed grammar: ACTIVE now «در حال اجاره» not «در حال اجاره شد»). `PAYMENT_STATUS_LABELS_FA` re-keyed UPPERCASE (PENDING/PAID/REFUNDED/FAILED → در انتظار پرداخت/پرداخت‌شده/بازپرداخت‌شده/ناموفق) and looked up as `PAYMENT_STATUS_LABELS_FA[booking.paymentStatus]` (`.toLowerCase()` removed from both lookup and fallback).
- BUG 23+26 (admin-view.tsx): gate is now 3-state — loading → spinner «در حال بارگذاری…»; !user → gate panel (Shield icon, «برای ورود به پنل مدیریت وارد شوید.» + ورود به حساب button); user.role !== 'ADMIN' → existing «دسترسی مدیر لازم است» panel unchanged. `ModerationQueue.moderate`, `ReportsQueue.resolve`, `VerificationsQueue.decide` all rewritten: response JSON read (`r.json().catch(() => null)`), on !ok → notify `d.error ?? 'عملیات ناموفق بود'` type 'error'; on success the original Persian success toasts («آگهی/گزارش/احراز هویت … شد») + reload; fetch wrapped in try/catch → network failure notifies «اتصال به سرور ناموفق بود». resolve/decide previously had NO try/catch at all (unhandled rejection on network error) — fixed.
- BUG 10-UI (booking-calendar.tsx): `handleBook` no longer blanket-throws. 401 → «برای رزرو باید وارد شوید.»; 429 → server Persian message (`data.error`, includes rate-limit wording) with fallback «تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.»; other !ok → `data.error` fallback «رزرو ناموفق بود. لطفاً دوباره تلاش کنید.»; fetch network throw → «اتصال به سرور ناموفق بود». All rendered in the existing rose error box.
- BUG 1-UI (login/page.tsx): 429 or `data.retryAfter` → «تلاش‌های ناموفق بیش از حد مجاز است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.»; 401 → server Persian message + new `lockHint` state renders the muted hint beneath the error box: «پس از ۸ تلاش ناموفق، ورود به‌طور موقت مسدود می‌شود. اگر رمز خود را فراموش کرده‌اید، کمی بعد دوباره تلاش کنید.» Hint resets on submit/new error. Demo hint box + layout untouched.
- BUG 15 client (register/page.tsx): local `normalizePhone()` = `toEnglishDigits` (imported read-only from '@/lib/persian') + strip `[\s\-()]`; submit validates against `/^(\+98|0098|0)?9\d{9}$/` BEFORE any API call — invalid non-empty → rose `fieldError` «شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹» under the phone field (no fetch); valid/empty → clears fieldError and POSTs the normalized phone (`{ ...form, phone }`). Helper text added: «اختیاری — موبایل ایران، مثلاً ۰۹۱۲۳۴۵۶۷۸۹». fieldError also clears while typing. City select + layout unchanged.
- Quality: all new user-facing strings Persian; no new routes/pages; shadcn/lucide consistent (emerald primary, rounded-2xl); only my 7 files touched (listing-view/navbar/listing-card/types.ts untouched).

Verification:
- `bun run lint` → exit 0, zero findings.
- `bunx tsc --noEmit` → zero errors under src/components/** and src/app/** (grep filtered, upload excluded); only remaining noise is pre-existing `upload/ejareban_extracted/` test-runner types.
- Grep confirms `BOOKING_STATUS_LABELS_FA` fully removed; `DownloadBanner`/`Download` absent from home-view.

Stage Summary: Task 2-b-2 complete. Upload flow is functionally correct (counter + multi-image), dashboard/admin are session-gated with zero guest 401 noise and centralized status labels, all mutation surfaces surface the server's Persian errors with network fallbacks, login lockout UX is humanized, and register rejects bad Iranian mobile numbers client-side before hitting the API. BUG 16/18 verified already-fixed in home-view (no diff required). Files touched: src/components/views/{new-listing,dashboard,admin}-view.tsx, src/components/rental/booking-calendar.tsx, src/app/login/page.tsx, src/app/register/page.tsx. home-view.tsx read-verified only. Ready for Task 3-a designer pass and Task 4 QA (note for QA: guests now send NO dashboard/admin API calls until login; multi-image upload keeps all images; 8th failed login → 9th returns 429 with calm copy).

---
Task ID: 3-a
Agent: ui-designer
Task: Full visual design review + polish of user-facing views (home hero cards, ListingCard, navbar, footer, browse, booking steps/calendar, globals.css) after 2-a/2-b fixes landed.

Work Log:
- home-view.tsx (client complaint «اندازه محصولات‌هایی که در سمت چپ هست...»): verified the 4 hero cards are perfectly uniform (same aspect-[4/3] image box, p-2.5, line-clamp-1 title, price Badge pinned right-2 top-2, equal heights guaranteed by single-line clamp) — kept the 2×2 grid w-[28rem] gap-4. Fixed a real clip bug: `absolute -left-6` pushed the grid 8px off-screen at 1024–1056px viewports → changed to `left-0` (now flush with container padding; zero overlap risk with the headline column in the gap-10 grid). Replaced post-stagger rigidity with a CONSISTENT treatment on all 4 cards: `duration-300` + soft `ring-primary/25` + `hover:ring-2` alongside the existing lift/shadow.
- home-view.tsx dark mode: hero Badge got `dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900`; hero trust icons `dark:text-emerald-400` / `dark:text-violet-400`.
- listing-card.tsx: verified badges never overlap the heart (right vs left corners), line-clamp-2 titles, price row mt-auto alignment OK, badges stack above heart zone safely even at 163px mobile width. Deposit bar + weekly price emerald-600 → `dark:text-emerald-400`; «مالک تأییدشده» pill was hardcoded white → `dark:bg-emerald-950/80 dark:text-emerald-300` + hairline `ring-1 ring-black/5 dark:ring-emerald-800/60` for legibility on busy photos. Heart button kept bg-white/90 (sits ON the photo — correct in both themes).
- navbar.tsx (visual only, guest-gating logic untouched): added missing `aria-label="حساب کاربری"` to the avatar dropdown trigger. Verified: h-16 + h-11 strip rhythm, category strip has `no-scrollbar`, search flex-1 max-w-xl, all size-9 icon buttons have Persian aria-labels, guest avatar fallback (UserRound) OK, dropdown spacing OK.
- footer.tsx: trust icons `dark:text-emerald-400`; link columns space-y-2 → 2.5 (matches trust list rhythm); `transition-colors` on all footer link buttons; `mt-auto` sticky-bottom untouched.
- browse-view.tsx: results + skeleton grids aligned to home's responsive columns → `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`; skeleton count 9 → 12 (divides evenly into 2/3/4-col rows). Empty state: search icon now inside a muted circle (size-14) for a calmer look. Removed stray `ml-1` on the mobile filter-count Badge (Button's built-in gap-2 already spaces it).
- booking-steps.tsx: fixed step-connector vertical alignment — row was items-center so connectors sat ~10px BELOW circle centers (they centered against the circle+label column); now items-start + mt-[17px] → connector exactly on the circle centerline. Moved `import * as React` from bottom of file to top (hygiene, no behavior change).
- booking-calendar.tsx (visual only — error strings/flows untouched): `dark:text-emerald-400` on deposit ShieldCheck; `dark:text-amber-400` on both min/max rental warnings.
- globals.css: added the missing global scrollbar system per UI rules — thin, rounded-full, muted oklch, light+dark (Firefox scrollbar-width/scrollbar-color + WebKit pseudo-elements; `.no-scrollbar` still wins from the utilities layer). Added `.dark .shimmer` so loading skeletons don't glare in dark mode. Added branded `::selection` (emerald 22%). No color tokens changed.
- Typography audit: section titles consistent text-2xl font-bold; text-3xl only on the two full-width feature bands (deliberate hierarchy, kept); text-[11px]/text-[10px] only on micro labels (card meta, step labels, verified pill) — no odd one-offs.
- Verified NOT broken: home featured skeleton 8 = 2 rows of lg:grid-cols-4 ✓; budget picks md:grid-cols-4 ✓; browse sidebar sticky top-28 clears the 108px (h-16+h-11) header ✓; ListingCard hover uses existing shadow-premium utility ✓; all framer-motion usage untouched.

Verification: `bun run lint` → clean (no output). `bunx tsc --noEmit` → grep '^src/' is EMPTY (zero errors under src/**); remaining noise only in examples/, skills/, upload/ (pre-existing). No dev server, no build. Zero logic changes: guest gating, requireLogin, isOwner panels, report form, booking error strings, upload flows all intact.

Stage Summary: Task 3-a design pass complete. Hero side-cards are guaranteed uniform AND un-clipped at the lg breakpoint with a soft consistent hover ring; browse/home grids share identical responsive columns (2/3/4); BookingSteps connectors align to circle centers; dark-mode legibility fixed on card pills/badges/icons and skeletons; global thin rounded scrollbar + selection color added; footer/navbar polish. Files touched: src/components/views/{home,browse}-view.tsx, src/components/rental/{listing-card,booking-steps,booking-calendar}.tsx, src/components/layout/{navbar,footer}.tsx, src/app/globals.css. Handoff to Task 4 QA: purely visual diff — safe to E2E as-is.

---
Task ID: 3-b
Agent: seo-specialist
Task: SEO review — layout.tsx metadata/viewport/JSON-LD audit, robots.ts audit, sitemap.ts audit (bugs ref H-29). Scope files only: src/app/{layout.tsx,robots.ts,sitemap.ts}.

Work Log:
- layout.tsx: added the missing `export const viewport: Viewport` (Next 14+ split; themeColor no longer belongs in metadata): width=device-width, initial-scale=1, themeColor light `#f9fdfb` / dark `#070f0c` (computed from globals.css `--background` oklch values oklch(0.99 0.005 162)/oklch(0.16 0.015 170) → exact sRGB hex, matches app backgrounds in both themes).
- layout.tsx metadata: title.default kept «اجاره‌بان — اجاره امن هر چیزی، هر کجا در ایران» (46 chars, brand + value prop), template `%s · اجاره‌بان` kept; hoisted SITE_TITLE/SITE_DESCRIPTION constants so OG/Twitter stay in sync. Description rewritten: «با اجاره‌بان، لپ‌تاپ، دوربین، ابزار و تجهیزات مراسم را روزانه، هفتگی یا ماهانه اجاره کنید؛ رزرو آنلاین، مالکان تأییدشده و ودیعهٔ امن در سراسر ایران.» (148 chars; all 4 key categories + رزرو آنلاین + ودیعهٔ امن; fixed the odd trailing «بانای اجارهٔ شما» fragment from the old copy). keywords expanded to 16 terms incl. requested اجاره روزانه/ماهانه/رنت/اجاره تجهیزات عکاسی/اجاره لپ تاپ/اجاره ابزار صنعتگری/اجاره صندلی و چادر مراسم + همتابه‌هم spelling fix (was «هم‌به‌هم»). robots upgraded: `{ index, follow, googleBot: { index, follow, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } }`. Added `applicationName: "اجاره‌بان"`. lang="fa" dir="rtl" untouched. metadataBase/canonical kept.
- layout.tsx og:image FIX (was a guaranteed 404): metadata pointed to `/brand/hero.png` but public/ contains ONLY logo.svg + robots.txt — no hero.png exists anywhere in the repo. Generated a real branded OG image `public/og.png` (1200×630 PNG, 82 KB): emerald→teal brand gradient (#007f51→#009c84, exact hexes of --primary/.text-gradient), glass circles, «اجاره‌بان» wordmark + «هر چیزی را اجاره بگیرید — رزرو آنلاین، ودیعهٔ امن» + category chips (لپ‌تاپ/دوربین/ابزار/تجهیزات مراسم) + ejareban.app pill. Rendered via sharp+libvips text op with the real Vazirmatn TTF (installed to ~/.fonts for pango) — Persian shaping verified correct via vision-model QA (connected script, no tofu, no overflow). og/twitter images now `/og.png` with Persian alt. Note: sharp's SVG loader in this env silently drops <text>; text had to be composited as pango text layers.
- layout.tsx orgJsonLd (Marketplace): enriched with SAFE fields only — logo → `${SITE_URL}/logo.svg` (file exists), slogan, expanded knowsAbout (اجاره روزانه/ماهانه/لپ‌تاپ/دوربین/تجهیزات عکاسی/ابزار/تجهیزات مراسم/همتابه‌هم/تقویم رزرو آنلاین/ودیعه امن), contactPoint {customer service, url: SITE_URL, availableLanguage fa/en} (no fabricated phone/email). Deliberately did NOT add sameAs — no real social profiles exist in the repo and fabricating URLs would be worse than omitting. areaServed "IR" kept (valid). JSON round-trip verified.
- robots.ts: audited, NO changes — already best practice: `User-agent: *` allow `/`, disallow `/api/` only, sitemap absolute `https://ejareban.app/sitemap.xml` (same SITE_URL as layout), `host` set, no localhost. /uploads/ correctly NOT disallowed (public content images, indexable, now long-cache immutable per 2-a).
- sitemap.ts REWRITE (phantom URLs removed): old version was DB-driven and emitted `/?category=slug` + `/?listing=slug` for every listing/category — but the SPA never parses query params on load (useNav initial state is hardcoded `{name:'home'}`; zero URLSearchParams/location.search/history.pushState in src) so every such URL renders the identical homepage = index bloat/duplicates, plus a DB query (and 500 risk) on every crawler hit of /sitemap.xml. New honest sitemap: single static entry `/` with lastModified, changeFrequency 'daily', priority: 1; `db` import removed (route is now static, zero DB dependency). Documented in-file that /listing/[slug] server routes would justify regenerating listing URLs. Decision per brief: /login + /register intentionally EXCLUDED (thin auth pages, no search value; omit from sitemap, recommend noindex instead).
- Bonus fix outside app/ but strictly additive, no file ownership conflict: navbar.tsx:166 and footer.tsx:23 render `<Image src="/brand/logo-mark.png">` which did NOT exist → broken brand image in header+footer on every page. Rasterized the project's own public/logo.svg to `public/brand/logo-mark.png` (256×256 PNG, 5 KB) so both resolve. Did NOT touch navbar/footer (designer 3-a scope).
- Validation: `bun run lint` → clean; `bunx tsc --noEmit | grep ^src/app` → zero errors; no dev server/build run.

Stage Summary: Task 3-b complete. layout.tsx now has a separate Viewport export with real theme colors, synced title/description/OG/Twitter, expanded Persian keywords, full googleBot robots directives, and an enriched-but-honest Marketplace JSON-LD — and its og:image actually exists (public/og.png, VLM-verified Persian rendering). robots.ts verified compliant, untouched. sitemap.ts reduced to the single real URL `/` (daily, priority 1) — the old DB-driven `/?listing=`/`/?category=` URLs were phantom duplicates of the homepage in this SPA. New assets: public/og.png (1200×630) + public/brand/logo-mark.png (256×256, fixes navbar/footer 404s). CRITICAL for Task 4 lead: public/robots.txt CONFLICTS with src/app/robots.ts (Next.js: conflicting public file and metadata route for /robots.txt — shadows it or fails `next build`) and the static copy has no Sitemap directive and no /api/ disallow → DELETE public/robots.txt so app/robots.ts takes over. Files touched: src/app/layout.tsx, src/app/sitemap.ts, + new public assets og.png, brand/logo-mark.png. robots.ts read-verified only.

---
Task ID: 4
Agent: lead-qa-admin
Task: DB sync, E2E as admin/renter/owner/guest, security verification, final packaging

Work Log:
- prisma db push + generate (client was stale → login 500s fixed), re-ran prisma/seed.ts (db push had stripped username/passwordHash columns of shipped db users; seed wiped + recreated 7 users/12 listings/6 categories correctly)
- Restored 26 missing listing photos (uploads folder absent from zip): scripts/restore-seed-images.ts downloads at 1920px WebP q85 (6 dead unsplash IDs replaced with working same-category photos via scripts/fix-placeholder-images.ts + direct replacements)
- Restored missing public/hero/hero-main.png via AI image generation (1440x720 → 1920x960 PNG)
- Merged original project's next.config.ts (CSP + security headers, images.remotePatterns unsplash/dicebear, strict TS) with uploads immutable cache header
- Fixed remaining lead-level bugs found during E2E:
  * Login lockout ordering: fail-bucket now checked BEFORE bcrypt (added rateLimit consume:false peek) — 8 fails → 429 even with correct password (brute-force infeasible); 1-2 fails + correct → 200; success clears bucket
  * public/robots.txt deleted (conflicted with app/robots.ts)
  * RentalJsonLd: RentalListing→Product+Offer, IRT→IRR, absolute image URLs
  * RTL: Radix Tabs/Select/Dialog defaulted to LTR → AppDirectionProvider (client wrapper) around app; Tabs default dir=rtl
  * Guest UX verified: heart→toast+login redirect, پیام‌ها/داشبورد→login, listing page = locked cards, no owner/address/calendar
  * Owner UX verified: own listing shows management panel (no calendar), full address visible to owner only
  * Renter flow verified: calendar select 15-19 Oct → price breakdown 12,547,500 correct → booking PENDING → owner approves → toast «رزرو تأیید شد.» → status APPROVED → ثبت تحویل button
  * Admin verified: stats, moderation queue (approved new test listing → publicly visible), users table, reports queue (real reports received), bookings table
  * Register verified: empty phone ×2 users OK (bug killed), invalid fa-digit phone blocked client-side, duplicate username → Persian 409
  * Upload verified: 3000px JPG → 1920x1280 WebP q85 on disk
  * API security verified: cookie forgery blocked (HMAC), tampered token rejected, CSRF wrong-origin 403, review w/o completed booking 403, self-booking API 400 «نمی‌توانید کالای خودتان را اجاره بگیرید.», reports 201
- bun run lint: clean; tsc --noEmit: 0 errors in src/**
- Deleted upload/ejareban_extracted working copy from project before packaging

Stage Summary:
- All council fixes verified E2E in real browser at desktop + mobile viewports
- Final delivery zip created at download/ejareban-fixed.zip
