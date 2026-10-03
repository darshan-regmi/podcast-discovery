/**
 * Canonical origin for the site, used by metadataBase, canonicals, the sitemap
 * and robots.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL (set this in production)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (stable production domain on Vercel)
 *   3. VERCEL_URL (per-deployment URL, e.g. previews)
 *   4. localhost, for development
 */
function withProtocol(host: string | undefined): string | undefined {
  if (!host) return undefined
  return host.startsWith('http') ? host : `https://${host}`
}

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  withProtocol(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  withProtocol(process.env.VERCEL_URL) ??
  'http://localhost:3000'
).replace(/\/$/, '')

export const SITE_NAME = 'Podcast Discovery'

export const SITE_DESCRIPTION =
  'Search episodes from podcasts you already follow, rate what you hear, and get recommendations ranked by the episodes you enjoyed. Ratings and saves stay on your device.'

/** Builds an absolute URL from a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
