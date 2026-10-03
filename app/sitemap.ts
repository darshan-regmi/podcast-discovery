import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// There are no per-episode routes (playback happens on the source audio), so
// the home page is the only indexable URL. /saved is noindex and omitted.
export const revalidate = 86400

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
