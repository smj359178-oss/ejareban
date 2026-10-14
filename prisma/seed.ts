import { PrismaClient } from '@prisma/client'
import { serializeImages } from '../src/lib/types'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// Hash a password synchronously using bcrypt (10 rounds — same as auth API).
function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10)
}

function slugify(s: string): string {
  // For Persian titles we fall back to a short hash-based slug.
  const ascii = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii) return ascii
  // Fallback: a small hash
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return 'l-' + Math.abs(h).toString(36)
}

const RAW_LISTINGS = [
  {
    title: 'مک‌بوک پرو ۱۴ اینچ M3 Pro',
    description:
      'مک‌بوک پرو ۱۴ اینچ با تراشه M3 Pro، ۱۸ گیگابایت حافظه یکپارچه و SSD ۵۱۲ گیگابایت. مناسب حرفه‌ای‌ترین کارهای تدوین ویدیو، طراحی و برنامه‌نویسی. به همراه شارژر ۹۶ وات و کاور محافظ. تعداد سیکل باتری کمتر از ۵۰.',
    condition: 'LIKE_NEW',
    brand: 'Apple',
    model: 'MacBook Pro 14 M3 Pro',
    category: 'electronics',
    city: 'تهران',
    address: 'سعادت‌آباد، خیابان راه‌آهن، پلاک ۱۲۴',
    dailyPrice: 850000,
    weeklyPrice: 4800000,
    monthlyPrice: 16500000,
    deposit: 8000000,
    images: [
      '/uploads/listings/1517336714731-489689fd1ca8.webp',
      '/uploads/listings/1611186871348-b1ce696e52c9.webp',
      '/uploads/listings/1496181133206-80ce9b88a853.webp',
    ],
    featured: true,
  },
  {
    title: 'دوربین سونی A7 IV بدون آینه',
    description:
      'دوربین فول‌فریم ۳۳ مگاپیکسل بدون آینه با لنز کیت ۲۸-۷۰ میلی‌متر. ویدیوی 4K با ۶۰ فریم، فوکوس خودکار در لحظه. شامل ۲ باتری، کارت حافظه ۱۲۸ گیگابایت و کیف محکم. مناسب عروس و داماد و تولید محتوا.',
    condition: 'GOOD',
    brand: 'Sony',
    model: 'ILCE-7M4',
    category: 'cameras',
    city: 'تهران',
    address: 'میرداماد، خیابان نلسون ماندلا، برج آرا، واحد ۵',
    dailyPrice: 1200000,
    weeklyPrice: 6500000,
    monthlyPrice: 22000000,
    deposit: 25000000,
    images: [
      '/uploads/listings/1502920917128-1aa500764cbd.webp',
      '/uploads/listings/1606983340126-99ab4feaa64a.webp',
      '/uploads/listings/1500634245200-758d746c1c14.webp',
    ],
    featured: true,
  },
  {
    title: 'پهپاد DJI Mavic 3',
    description:
      'پهپاد DJI Mavic 3 با دوربین Hasselblad، ویدیوی 5.1K و ۴۶ دقیقه زمان پرواز. پکیج Fly More با ۳ باتری، فیلتر ND و شارژر چندگانه. مناسب عکاسی هوایی و نقشه‌برداری.',
    condition: 'LIKE_NEW',
    brand: 'DJI',
    model: 'Mavic 3',
    category: 'cameras',
    city: 'کرج',
    address: 'گوهردشت، بلوار امیرکبیر، ساختمان سینا',
    dailyPrice: 1500000,
    weeklyPrice: 8000000,
    monthlyPrice: 28000000,
    deposit: 40000000,
    images: [
      '/uploads/listings/1473968512647-3e447244af8f.webp',
      '/uploads/listings/1507582020474-9a35b7d455d9.webp',
    ],
    featured: true,
  },
  {
    title: 'دریل چکشی بوش',
    description:
      'دریل چکشی حرفه‌ای SDS-plus با سه حالت: ساده، چکشی و کوهانه. ۸۰۰ وات، به همراه ۳ مته و فنس عمق‌سنج. مناسب کارهای ساختمانی و بازسازی سنگین.',
    condition: 'GOOD',
    brand: 'Bosch',
    model: 'GBH 2-28',
    category: 'tools',
    city: 'تهران',
    address: 'شهرک غرب، خیابان ایران‌زمین، پلاک ۸۷',
    dailyPrice: 220000,
    weeklyPrice: 1100000,
    monthlyPrice: 3800000,
    deposit: 2000000,
    images: [
      '/uploads/listings/1572981779307-09b8d0150c2a.webp',
      '/uploads/listings/1530124566582-a618bc2615dc.webp',
    ],
  },
  {
    title: 'واتر جت کارچر K5',
    description:
      'دستگاه واشر فشار بالا ۱۴۵ بار، مناسب ماشین، حیاط و نما. شامل لانس اسپری متغیر، کثیف‌شوی و شلنگ فشار ۸ متری. شست‌وشوی سریع و کارآمد.',
    condition: 'LIKE_NEW',
    brand: 'Karcher',
    model: 'K5',
    category: 'tools',
    city: 'اصفهان',
    address: 'خیابان چهارباغ بالا، روبروی پارک',
    dailyPrice: 180000,
    weeklyPrice: 900000,
    monthlyPrice: 3000000,
    deposit: 1500000,
    images: [
      '/uploads/listings/1607498284476-9b3b6c8e2f1c.webp',
      '/uploads/listings/1581094794329-c8112a89af12.webp',
    ],
  },
  {
    title: 'پروژکتور اپسون EB-FH52 فول‌اچ‌دی',
    description:
      'پروژکتور ۳۵۰۰ لومن فول‌اچ‌دی ۱۰۸۰p با HDMI و USB. مناسب سینمای خانگی، مراسم و ارائه. به همراه پرده ۱۰۰ اینچی و کابل HDMI.',
    condition: 'GOOD',
    brand: 'Epson',
    model: 'EB-FH52',
    category: 'events',
    city: 'تهران',
    dailyPrice: 450000,
    weeklyPrice: 2300000,
    monthlyPrice: 8000000,
    deposit: 6000000,
    images: [
      '/uploads/listings/1626379953822-baec19c3accd.webp',
      '/uploads/listings/1517604931442-7e0c8ed2963c.webp',
    ],
    featured: true,
  },
  {
    title: 'اسپیکر JBL PartyBox 1000',
    description:
      'اسپیکر قابل‌حمل ۱۱۰۰ واتی با نورپردازی LED، بلوتوث و ورودی کاریوکی. بیس قدرتمند و صدای شفاف برای مراسم تا ۱۵۰ نفر. به همراه میکروفون بی‌سیم.',
    condition: 'LIKE_NEW',
    brand: 'JBL',
    model: 'PartyBox 1000',
    category: 'events',
    city: 'شیراز',
    dailyPrice: 380000,
    weeklyPrice: 1900000,
    monthlyPrice: 6500000,
    deposit: 5000000,
    images: [
      '/uploads/listings/1608043152269-f4cd465aa6fd.webp',
      '/uploads/listings/1545454675-3531b543be5d.webp',
    ],
  },
  {
    title: 'دوچرخه کوهستان Trek Marlin 7',
    description:
      'دوچرخه تریل ۲۹ اینچ هاردتیل با ترمز دیسکی هیدرولیک و دنده ۱x۱۲. شامل کلاه، چراغ و قفل. سرویس‌شده و آماده مسیر.',
    condition: 'GOOD',
    brand: 'Trek',
    model: 'Marlin 7',
    category: 'sports',
    city: 'تبریز',
    dailyPrice: 260000,
    weeklyPrice: 1300000,
    monthlyPrice: 4200000,
    deposit: 4000000,
    images: [
      '/uploads/listings/1532298229144-0ec0c57515c7.webp',
      '/uploads/listings/1485965120184-e220f721d03e.webp',
    ],
  },
  {
    title: 'پلی‌استیشن ۵ + ۲ دسته + ۵ بازی',
    description:
      'پلی‌استیشن ۵ نسخه دیسک با ۲ دسته DualSense و ۵ بازی محبوب (FIFA، God of War، Spider-Man، GTA V، Elden Ring). مناسب آخر هفته و دورهمی.',
    condition: 'LIKE_NEW',
    brand: 'Sony',
    model: 'PlayStation 5',
    category: 'electronics',
    city: 'مشهد',
    dailyPrice: 320000,
    weeklyPrice: 1700000,
    monthlyPrice: 5800000,
    deposit: 9000000,
    images: [
      '/uploads/listings/1606144042614-b2417e99c4e3.webp',
      '/uploads/listings/1607853202273-797f1c22a38e.webp',
    ],
    featured: true,
  },
  {
    title: 'هدست واقعیت مجازی Quest 3',
    description:
      'هدست VR مستقل ۱۲۸ گیگابایت با دسته‌ها و پایه شارژ. مناسب بازی، جلسات مجازی و ویدیوی ۳۶۰ درجه. به همراه بند راحت.',
    condition: 'LIKE_NEW',
    brand: 'Meta',
    model: 'Quest 3',
    category: 'electronics',
    city: 'تهران',
    dailyPrice: 290000,
    weeklyPrice: 1500000,
    monthlyPrice: 5200000,
    deposit: 7000000,
    images: [
      '/uploads/listings/1622979135225-d2ba269cf1ac.webp',
      '/uploads/listings/1593508512255-86ab6a878cf0.webp',
    ],
  },
  {
    title: 'چادر کمپینگ ۶ نفره',
    description:
      'چادر گنبدی جادار ۶ نفره با پرده ضدآب و سایبان. نصب آسان در ۱۰ دقیقه. شامل تشک خواب و اجاق کمپینگ. مناسب سفرهای خانوادگی.',
    condition: 'GOOD',
    brand: 'Coleman',
    model: 'Sundome 6',
    category: 'sports',
    city: 'کرج',
    dailyPrice: 150000,
    weeklyPrice: 750000,
    monthlyPrice: 2500000,
    deposit: 1200000,
    images: [
      '/uploads/listings/1504280390367-361c166d5500.webp',
      '/uploads/listings/1517824806704-9040b037703b.webp',
    ],
  },
  {
    title: 'چرخ خیاطی صنعتی',
    description:
      'چرخ خیاطی صنعتی سنگین برای چرم، دنیم و روپوش. به همراه میز، موتور و کیف لوازم. مناسب کسب‌وکارهای خیاطی کوچک.',
    condition: 'GOOD',
    brand: 'Juki',
    model: 'DDL-8700',
    category: 'tools',
    city: 'قم',
    dailyPrice: 240000,
    weeklyPrice: 1200000,
    monthlyPrice: 4000000,
    deposit: 3000000,
    images: [
      '/uploads/listings/1585559700398-1385b3a8aeb6.webp',
      '/uploads/listings/1558769132-cb1aea458c5e.webp',
    ],
  },
]

const CATEGORIES = [
  { name: 'الکترونیک', slug: 'electronics', icon: 'Laptop', color: 'from-violet-500 to-purple-600' },
  { name: 'دوربین و عکاسی', slug: 'cameras', icon: 'Camera', color: 'from-rose-500 to-pink-600' },
  { name: 'ابزار و ماشین‌آلات', slug: 'tools', icon: 'Wrench', color: 'from-amber-500 to-orange-600' },
  { name: 'مراسم و رویداد', slug: 'events', icon: 'PartyPopper', color: 'from-emerald-500 to-teal-600' },
  { name: 'ورزش و طبیعت', slug: 'sports', icon: 'Mountain', color: 'from-sky-500 to-cyan-600' },
  { name: 'وسایل نقلیه', slug: 'vehicles', icon: 'Car', color: 'from-indigo-500 to-blue-600' },
]

async function main() {
  console.log('🌱 Seeding Ejareban database...')

  // Wipe
  await db.message.deleteMany()
  await db.conversation.deleteMany()
  await db.notification.deleteMany()
  await db.report.deleteMany()
  await db.verificationRequest.deleteMany()
  await db.review.deleteMany()
  await db.favorite.deleteMany()
  await db.availability.deleteMany()
  await db.booking.deleteMany()
  await db.listing.deleteMany()
  await db.category.deleteMany()
  await db.user.deleteMany()

  // Users
  // Default credentials are documented in README. The admin can log in with
  // username `admin` + password `ejareban-admin`. Each owner has its own
  // username/password. The renter demo account uses `renter` / `renter123`.
  const admin = await db.user.create({
    data: {
      email: 'admin@ejareban.app',
      username: 'admin',
      name: 'بانای اجاره‌بان',
      firstName: 'بانای',
      lastName: 'اجاره‌بان',
      role: 'ADMIN',
      passwordHash: hashPassword('ejareban-admin'),
      isIdentityVerified: true,
      isPhoneVerified: true,
      trustScore: 100,
      ratingSum: 0,
      ratingCount: 0,
      city: 'تهران',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Ejareban&backgroundColor=4f46e5',
    },
  })

  const owners = await Promise.all(
    [
      { name: 'امیر حسینی', firstName: 'امیر', lastName: 'حسینی', city: 'تهران', email: 'amir@ejareban.app', username: 'amir', password: 'amir123' },
      { name: 'سارا احمدی', firstName: 'سارا', lastName: 'احمدی', city: 'کرج', email: 'sara@ejareban.app', username: 'sara', password: 'sara123' },
      { name: 'رضا کریمی', firstName: 'رضا', lastName: 'کریمی', city: 'اصفهان', email: 'reza@ejareban.app', username: 'reza', password: 'reza123' },
      { name: 'نیلوفر ابراهیمی', firstName: 'نیلوفر', lastName: 'ابراهیمی', city: 'شیراز', email: 'nili@ejareban.app', username: 'niloofar', password: 'niloofar123' },
      { name: 'محمد جعفری', firstName: 'محمد', lastName: 'جعفری', city: 'تبریز', email: 'mohammad@ejareban.app', username: 'mohammad', password: 'mohammad123' },
    ].map((u, i) =>
      db.user.create({
        data: {
          email: u.email,
          username: u.username,
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash: hashPassword(u.password),
          role: 'OWNER',
          isIdentityVerified: true,
          isPhoneVerified: true,
          trustScore: 78 + i * 4,
          ratingSum: (4 + i) * 5,
          ratingCount: 4 + i,
          city: u.city,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=0ea5e9,10b981,f59e0b,ec4899`,
        },
      }),
    ),
  )

  const renter = await db.user.create({
    data: {
      email: 'renter@ejareban.app',
      username: 'renter',
      name: 'کاربر نمونه',
      firstName: 'کاربر',
      lastName: 'نمونه',
      role: 'USER',
      passwordHash: hashPassword('renter123'),
      isPhoneVerified: true,
      trustScore: 65,
      city: 'تهران',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Renter&backgroundColor=6366f1',
    },
  })

  // Categories
  const catMap: Record<string, string> = {}
  for (const c of CATEGORIES) {
    const created = await db.category.create({ data: { ...c, listingCount: 0 } })
    catMap[c.slug] = created.id
  }

  // Listings
  let count = 0
  for (const raw of RAW_LISTINGS) {
    const owner = owners[count % owners.length]
    const slug = `${slugify(raw.title)}-${Math.random().toString(36).slice(2, 6)}`
    const listing = await db.listing.create({
      data: {
        ownerId: owner.id,
        categoryId: catMap[raw.category],
        title: raw.title,
        slug,
        description: raw.description,
        condition: raw.condition,
        images: serializeImages(raw.images),
        brand: raw.brand,
        model: raw.model,
        city: raw.city,
        address: (raw as { address?: string }).address ?? null,
        dailyPrice: raw.dailyPrice,
        weeklyPrice: raw.weeklyPrice,
        monthlyPrice: raw.monthlyPrice,
        deposit: raw.deposit,
        minRentalDays: 1,
        maxRentalDays: 90,
        deliveryAvailable: true,
        deliveryFee: 120000,
        replacementValue: raw.deposit * 4,
        status: 'ACTIVE',
        moderationStatus: 'APPROVED',
        featured: raw.featured ?? false,
        ratingSum: Math.round((3.8 + Math.random() * 1.2) * 7),
        ratingCount: 7,
        views: 120 + Math.floor(Math.random() * 900),
        bookingsCount: 2 + Math.floor(Math.random() * 14),
      },
    })
    count++

    // Seed a few reviews
    const reviewCount = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < reviewCount; i++) {
      const reviewer = owners[(count + i + 1) % owners.length]
      const rating = Math.random() > 0.2 ? 5 : 4
      await db.review.create({
        data: {
          listingId: listing.id,
          reviewerId: reviewer.id,
          revieweeId: owner.id,
          rating,
          comment: [
            'وضعیت عالی و تحویل بدون مشکل. قطعا پیشنهاد می‌کنم.',
            'دقیقاً مطابق توضیحات، مالک پاسخگو و منعطف بود.',
            'تمیز، سرویس‌شده و قابل اعتماد. دوباره اجاره می‌کنم.',
            'ارزشش رو داره. تحویل سر وقت بود.',
            'تجربه خوبی بود، وسیله برای پروژه‌ام بی‌نقص کار کرد.',
          ][i % 5],
        },
      })
    }
  }

  // Recompute category counts + owner rating aggregates
  const allCats = await db.category.findMany()
  for (const c of allCats) {
    const n = await db.listing.count({
      where: { categoryId: c.id, status: 'ACTIVE', moderationStatus: 'APPROVED' },
    })
    await db.category.update({ where: { id: c.id }, data: { listingCount: n } })
  }

  // Seed one upcoming booking for the demo renter on the first listing
  const firstListing = await db.listing.findFirst({
    where: { featured: true },
    orderBy: { createdAt: 'asc' },
  })
  if (firstListing) {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 14)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 2)
    const days = 3
    await db.booking.create({
      data: {
        listingId: firstListing.id,
        renterId: renter.id,
        ownerId: firstListing.ownerId,
        startDate: start,
        endDate: end,
        days,
        pricingTier: 'DAILY',
        dailyRate: firstListing.dailyPrice,
        rentalPrice: firstListing.dailyPrice * days,
        depositTotal: firstListing.deposit,
        deliveryFee: firstListing.deliveryFee,
        serviceFee: Math.round(firstListing.dailyPrice * days * 0.07),
        discount: 0,
        totalAmount:
          firstListing.dailyPrice * days +
          firstListing.deposit +
          firstListing.deliveryFee +
          Math.round(firstListing.dailyPrice * days * 0.07),
        deliveryOption: 'PICKUP',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        message: 'ممنون می‌شم برای پروژه آخر هفته‌ام تحویل بگیرم. مرسی!',
      },
    })
  }

  // Seed an open report + a pending verification for the admin panel demo
  const someListing = await db.listing.findFirst()
  if (someListing) {
    await db.report.create({
      data: {
        reporterId: renter.id,
        listingId: someListing.id,
        reason: 'spam',
        description: 'به نظر می‌رسد عکس‌ها از سایت هستند، نه خود کالا.',
        status: 'OPEN',
      },
    })
  }
  await db.verificationRequest.create({
    data: {
      userId: renter.id,
      nationalId: '0012345678',
      phone: '+989121234567',
      status: 'PENDING',
    },
  })

  console.log(`✅ Seeded ${count} listings, ${CATEGORIES.length} categories, ${owners.length + 2} users.`)
  console.log(`   Admin: ${admin.email}`)
  console.log(`   Demo renter: ${renter.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
