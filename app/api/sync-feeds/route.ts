import { NextResponse } from 'next/server'
import { parseFeed } from '@/lib/rss'
import feedsData from '@/data/feeds.json'
import type { Episode, Feed } from '@/lib/types'

export async function GET() {
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

  return NextResponse.json({ episodes, errors })
}
