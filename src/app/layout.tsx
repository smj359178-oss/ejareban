import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppDirectionProvider } from "@/components/shared/app-direction-provider";
import { SessionProvider } from "@/components/shared/session-provider";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const SITE_URL = "https://ejareban.app";
const SITE_TITLE = "اجاره‌بان — اجاره امن هر چیزی، هر کجا در ایران";
const SITE_DESCRIPTION =
  "با اجاره‌بان، لپ‌تاپ، دوربین، ابزار و تجهیزات مراسم را روزانه، هفتگی یا ماهانه اجاره کنید؛ رزرو آنلاین، مالکان تأییدشده و ودیعهٔ امن در سراسر ایران.";

// Viewport must be a separate export since Next.js 14+ (themeColor moved out
// of metadata). Colors mirror --background in globals.css (light/dark).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fdfb" },
    { media: "(prefers-color-scheme: dark)", color: "#070f0c" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · اجاره‌بان",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "اجاره",
    "اجاره روزانه",
    "اجاره ماهانه",
    "رنت",
    "اجاره لپ تاپ",
    "اجاره لپ‌تاپ",
    "اجاره دوربین",
    "اجاره تجهیزات عکاسی",
    "اجاره ابزار",
    "اجاره ابزار صنعتگری",
    "اجاره تجهیزات مراسم",
    "اجاره صندلی و چادر مراسم",
    "پلتفرم اجاره",
    "اجاره همتابه‌هم",
    "اجاره‌بان",
    "Ejareban",
  ],
  authors: [{ name: "اجاره‌بان" }],
  applicationName: "اجاره‌بان",
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "اجاره‌بان",
    locale: "fa_IR",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "اجاره‌بان — هر چیزی را اجاره بگیرید؛ رزرو آنلاین، ودیعهٔ امن",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// Safe enrichment only: no fabricated social profiles (sameAs) or phone/email
// (contactPoint.telephone) — add real ones to sameAs when accounts exist.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Marketplace",
  name: "اجاره‌بان",
  alternateName: "Ejareban",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  slogan: "اجاره امن هر چیزی، هر کجا در ایران",
  description:
    "پلتفرم مدرن اجاره تجهیزات، لوازم الکترونیکی، دوربین، ابزار و تجهیزات رویدادی در ایران.",
  areaServed: "IR",
  knowsAbout: [
    "اجاره روزانه",
    "اجاره ماهانه",
    "اجاره لپ‌تاپ",
    "اجاره دوربین",
    "اجاره تجهیزات عکاسی",
    "اجاره ابزار",
    "اجاره تجهیزات مراسم",
    "اجاره همتابه‌هم",
    "تقویم رزرو آنلاین",
    "ودیعه امن",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    url: SITE_URL,
    availableLanguage: ["fa", "en"],
  },
  inLanguage: "fa-IR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* U2: ONE session fetch shared by the whole app via context. */}
          <SessionProvider>
            {/* RTL direction for every Radix primitive (Tabs, Select, Dialog,
                DropdownMenu…) — without this they silently default to ltr and
                break Persian text punctuation inside their content. */}
            <AppDirectionProvider>{children}</AppDirectionProvider>
          </SessionProvider>
          <Toaster
            richColors
            position="top-center"
            dir="rtl"
            closeButton
          />
        </ThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}
