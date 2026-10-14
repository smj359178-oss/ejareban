import type { NextConfig } from "next";

// Security headers applied to every route. Each header is documented inline
// so future edits preserve the intent rather than the literal value.
const securityHeaders = [
  // Clickjacking protection — only same-origin framers may embed us.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing — the declared Content-Type is authoritative.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer control — only send the origin when crossing sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS — force HTTPS for two years, including subdomains, eligible for preload.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Browser permissions policy — camera/microphone/geolocation only for same-origin.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self)",
  },
  // Content Security Policy — restrict script/style/font/image/connect sources.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // X-XSS-Protection — legacy browsers still benefit from the auditor.
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Surface TypeScript errors at build time instead of hiding them.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  images: {
    // Remote hosts whose images we proxy through next/image. Local uploads live
    // under /public/uploads and do not need an entry here.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Listing photos are content-addressed (uuid filenames, never mutated
        // in place), so they can be cached forever. This makes repeat visits
        // load images instantly from the browser/CDN cache (bug 20-API).
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
