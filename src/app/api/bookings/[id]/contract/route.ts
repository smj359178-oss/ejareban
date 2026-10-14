import { NextRequest } from 'next/server'
import PDFDocument from 'pdfkit'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { formatToman } from '@/lib/format'
import { formatJalaliDate } from '@/lib/persian'

export const dynamic = 'force-dynamic'

/**
 * Generate a digital rental contract as a PDF.
 *
 * The contract includes the parties, the rental item, the period, fees,
 * deposit, and return conditions. In production this must be sealed with a
 * digital signature (GPG / PKCS#7) and timestamped by a trust service.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getSession(req)
  if (!user) {
    return new Response('برای مشاهدهٔ قرارداد باید وارد شوید.', { status: 401 })
  }
  const { id } = await params

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      listing: { include: { category: true } },
      renter: true,
      owner: true,
    },
  })
  if (!booking) {
    return new Response('رزرو مورد نظر یافت نشد.', { status: 404 })
  }
  // Only the contract parties or an admin may view the contract
  if (
    booking.renterId !== user.id &&
    booking.ownerId !== user.id &&
    user.role !== 'ADMIN'
  ) {
    return new Response('شما اجازهٔ مشاهدهٔ این قرارداد را ندارید.', { status: 403 })
  }

  // Build the PDF
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `قرارداد اجاره ${booking.listing.title}`,
      Author: 'اجاره‌بان',
      Subject: 'قرارداد اجاره کالا',
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const pdfDone = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // ---- Header ----
  doc
    .fontSize(22)
    .fillColor('#0f766e')
    .text('قرارداد اجاره کالا', { align: 'center' })
  doc.moveDown(0.3)
  doc
    .fontSize(10)
    .fillColor('#666')
    .text('پلتفرم اجاره اجاره‌بان — Ejareban Rental Platform', {
      align: 'center',
    })
  doc
    .moveTo(50, doc.y + 5)
    .lineTo(doc.page.width - 50, doc.y + 5)
    .strokeColor('#0f766e')
    .lineWidth(1.5)
    .stroke()
  doc.moveDown(1)

  // ---- Contract number and date ----
  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`شماره قرارداد: ${booking.id}`, 50, doc.y, { continued: true })
  doc.text(`تاریخ صدور: ${formatJalaliDate(new Date())}`, {
    align: 'right',
  })
  doc.moveDown(1)

  // ---- Parties ----
  doc.fontSize(13).fillColor('#0f766e').text('مشخصات طرفین')
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#222')
  doc.text(`اجاره‌دهنده (مالک): ${booking.owner.name}`)
  doc.text(`ایمیل: ${booking.owner.email}`)
  if (booking.owner.phone) doc.text(`تلفن: ${booking.owner.phone}`)
  doc.moveDown(0.5)
  doc.text(`اجاره‌گیرنده: ${booking.renter.name}`)
  doc.text(`ایمیل: ${booking.renter.email}`)
  if (booking.renter.phone) doc.text(`تلفن: ${booking.renter.phone}`)
  doc.moveDown(1)

  // ---- Item ----
  doc.fontSize(13).fillColor('#0f766e').text('مشخصات کالای اجاره‌ای')
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#222')
  doc.text(`عنوان: ${booking.listing.title}`)
  if (booking.listing.brand)
    doc.text(`برند/مدل: ${booking.listing.brand} ${booking.listing.model || ''}`)
  doc.text(`دسته‌بندی: ${booking.listing.category?.name || '-'}`)
  doc.text(`شهر: ${booking.listing.city}`)
  doc.moveDown(1)

  // ---- Rental period ----
  doc.fontSize(13).fillColor('#0f766e').text('دوره اجاره')
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#222')
  doc.text(`تاریخ شروع: ${formatJalaliDate(booking.startDate)}`)
  doc.text(`تاریخ پایان: ${formatJalaliDate(booking.endDate)}`)
  doc.text(`مدت: ${booking.days} روز`)
  doc.text(
    `نحوه تحویل: ${booking.deliveryOption === 'DELIVERY' ? 'ارسال توسط مالک' : 'مراجعه حضوری'}`,
  )
  doc.moveDown(1)

  // ---- Fees ----
  doc.fontSize(13).fillColor('#0f766e').text('شرح هزینه‌ها')
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#222')
  const line = (label: string, value: string) => {
    doc.text(label, 50, doc.y, { continued: true, width: 300 })
    doc.text(value, { align: 'right' })
  }
  line(
    `اجاره‌بها (${booking.pricingTier === 'MONTHLY' ? 'ماهانه' : booking.pricingTier === 'WEEKLY' ? 'هفتگی' : 'روزانه'} — ${formatToman(booking.dailyRate)}/روز × ${booking.days} روز)`,
    formatToman(booking.rentalPrice),
  )
  line('کارمزد سرویس', formatToman(booking.serviceFee))
  if (booking.deliveryFee > 0)
    line('هزینه ارسال', formatToman(booking.deliveryFee))
  line('ودیعه (قابل بازگشت)', formatToman(booking.depositTotal))
  doc
    .moveTo(50, doc.y + 2)
    .lineTo(doc.page.width - 50, doc.y + 2)
    .strokeColor('#999')
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.3)
  doc.fontSize(12).fillColor('#0f766e')
  line('مجموع قابل پرداخت', formatToman(booking.totalAmount))
  doc.moveDown(1)

  // ---- Terms ----
  doc.fontSize(13).fillColor('#0f766e').text('شرایط و ضوابط')
  doc.moveDown(0.3)
  doc.fontSize(9).fillColor('#444')
  const terms = [
    '۱. اجاره‌گیرنده متعهد می‌شود کالا را با همان شرایط تحویلی، در پایان دوره بازگرداند.',
    '۲. در صورت بروز خسارت، مبلغ از ودیعه کسر و در صورت ناکافی بودن، اجاره‌گیرنده مکلف به جبران مازاد است.',
    '۳. تأخیر در بازگشت کالا به ازای هر روز، معادل یک روز اجاره‌بها محاسبه می‌شود.',
    '۴. کالا فقط برای استفاده شخصی و قانونی اجاره‌گیرنده است؛ انتقال به غیر ممنوع است.',
    '۵. ودیعه حداکثر ظرف ۴۸ ساعت پس از بازگشت کالا و بررسی وضعیت، بازپرداخت می‌شود.',
    '۶. اختلافات ابتدا از طریق پلتفرم اجاره‌بان و در صورت عدم حل، از طریق مراجع قانونی رسیدگی می‌شود.',
    '۷. این قرارداد با پذیرش الکترونیکی توسط هر دو طرف منعقد می‌گردد و به‌منزله قرارداد مکتوب قانونی است.',
  ]
  for (const t of terms) {
    doc.text(t, { align: 'right', indent: 0 })
    doc.moveDown(0.2)
  }
  doc.moveDown(1)

  // ---- Signatures ----
  doc.fontSize(10).fillColor('#222')
  const sigY = doc.y + 20
  doc.text('امضای اجاره‌دهنده:', 50, sigY)
  doc.text('امضای اجاره‌گیرنده:', 300, sigY)
  doc
    .moveTo(50, sigY + 40)
    .lineTo(230, sigY + 40)
    .strokeColor('#999')
    .stroke()
  doc
    .moveTo(300, sigY + 40)
    .lineTo(480, sigY + 40)
    .strokeColor('#999')
    .stroke()

  doc.moveDown(3)
  doc
    .fontSize(8)
    .fillColor('#999')
    .text(
      `این قرارداد توسط پلتفرم اجاره‌بان به‌صورت خودکار تولید شده است. شناسه: ${booking.id}`,
      { align: 'center' },
    )

  doc.end()

  const pdfBuffer = await pdfDone

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ejareban-contract-${booking.id}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'private, no-cache',
    },
  })
}
