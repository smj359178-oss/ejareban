import type { MetadataRoute } from 'next'

const SITE_URL = 'https://ejareban.app'

/**
 * Honest sitemap for a single-route SPA.
 *
 * Ejareban switches views client-side (zustand `useNav`); there is no server
 * route per listing and the app never parses `?listing=` / `?category=` on
 * load, so URLs like `https://ejareban.app/?listing=slug` would all render the
 * exact same home page. Listing them here would create thousands of phantom
 * duplicate URLs (index bloat) — so the sitemap contains only the one real,
 * indexable URL. If server-rendered listing routes (`/listing/[slug]`) are
 * ever added, generate those URLs here from the database again.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
