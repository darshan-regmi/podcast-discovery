import { parseFeed } from './rss'
import feedsData from '@/data/feeds.json'
import type { Episode, Feed } from './types'

export interface FeedSyncResult {
  episodes: Episode[]
  errors: string[]
}

/**
 * Fetch and normalise every configured feed, newest episode first.
 *
 * Shared by the home page (server-rendered) and the `/api/sync-feeds` route so
 * both show the same data. `allSettled` means one dead feed degrades to an
 * entry in `errors` instead of failing the whole request.
 */
export async function getAllEpisodes(): Promise<FeedSyncResult> {
  const feeds = feedsData as Feed[]

  const results = await Promise.allSettled(
    feeds.map(feed => parseFeed(feed.rssUrl, feed.id, feed.title, feed.tags))
  )

  const episodes: Episode[] = []
  const errors: string[] = []

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      episodes.push(...result.value)
    } else {
      errors.push(`${feeds[i].title}: ${result.reason}`)
    }
  })

  episodes.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return { episodes, errors }
}
