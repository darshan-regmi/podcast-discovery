import Parser from 'rss-parser'
import type { Episode } from './types'

// A full minute (the default) can stall a server-render or build; 10s is
// plenty for a feed and lets a dead host fail fast.
const parser = new Parser({ timeout: 10_000 })

function parseDuration(raw: string | undefined): number {
  if (!raw) return 0
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  const parts = raw.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  return parts.reduce((acc, val) => acc * 60 + val, 0)
}

export async function parseFeed(
  rssUrl: string,
  feedId: string,
  feedTitle: string,
  feedTags: string[]
): Promise<Episode[]> {
  const feed = await parser.parseURL(rssUrl)

  return feed.items
    .filter(item => item.enclosure?.url)
    .map((item, index) => ({
      id: `${feedId}-${item.guid ?? index}`,
      feedId,
      feedTitle,
      title: item.title ?? 'Untitled episode',
      description: item.contentSnippet ?? '',
      audioUrl: item.enclosure!.url,
      publishedAt: item.isoDate ?? new Date().toISOString(),
      durationSeconds: parseDuration(item.itunes?.duration),
      tags: feedTags,
    }))
}
