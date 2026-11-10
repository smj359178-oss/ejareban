# اسکریپت مهاجرت SQLite → PostgreSQL
#
# این اسکریپت مراحل مهاجرت از SQLite به PostgreSQL را نشان می‌دهد.
# برای اجرای واقعی، ابتدا یک پایگاه داده PostgreSQL ایجاد کنید و
# متغیر DATABASE_URL را تنظیم کنید.
#
# نحوه استفاده:
#   1. یک پایگاه داده PostgreSQL بسازید:
#        createdb ejareto
#   2. DATABASE_URL را در فایل .env تنظیم کنید:
#        DATABASE_URL="postgresql://user:pass@localhost:5432/ejareto"
#   3. provider را در prisma/schema.prisma به postgresql تغییر دهید
#   4. اجرا:
#        bun run db:push        # ساخت اسکما
#        bun x tsx prisma/migrate-from-sqlite.ts  # انتقال داده
#
# نکته: اسکیمای Prisma با هر دو SQLite و PostgreSQL سازگار است
# زیرا از لیست‌ها استفاده نمی‌کنیم (JSON String به جای آن).
# تنها تغییر لازم: provider = "postgresql"

set -e

echo "📦 مهاجرت SQLite → PostgreSQL"
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL تنظیم نشده. لطفاً ابتدا آن را در .env قرار دهید."
  echo "   مثال: DATABASE_URL=\"postgresql://user:pass@localhost:5432/ejareto\""
  exit 1
fi

echo "1️⃣  ساخت اسکما در PostgreSQL..."
bun run db:push

echo ""
echo "2️⃣  انتقال داده از SQLite قدیمی..."
bun x tsx prisma/migrate-from-sqlite.ts

echo ""
echo "✅ مهاجرت کامل شد!"
echo ""
echo "📝 توجه: برای فعال‌سازی Redis برای Rate Limiting:"
echo "   1. REDIS_URL را در .env تنظیم کنید"
echo "   2. در src/lib/rate-limit.ts، in-memory Map را با Redis جایگزین کنید"
echo "   3. مستندات: docs/MIGRATION.md"
