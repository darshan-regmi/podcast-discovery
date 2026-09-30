# Tutorial: Building the Podcast Discovery Engine

This is the follow-along version of `BUILD_PLAN.md`. Same nine phases, same order, but every file is here in full, ready to copy in, plus a way to check each phase actually works before moving to the next one.

Every piece of code below was actually written, installed, and compiled in a real Next.js project before going into this document, not just typed out from memory. Two things turned up during that process that are worth knowing before you start: `itunes:duration` shows up in three different formats across real feeds (handled in Phase 1), and the recommendation engine cannot be a server API route, because the ratings it needs live in the browser's localStorage, not on the server (explained properly in Phase 6, and this corrects the original build plan, which got that one wrong).

## Prerequisites

- Node 18 or newer (Node 22 works fine)
- A code editor
- A GitHub account and a Vercel account, both free, needed only for Phase 9

## Before you start

Pick 5 to 10 podcasts you actually listen to and find their RSS feed URLs (search "[podcast name] rss feed" if it is not linked from the show's own website). The examples in this tutorial use two real, currently live feeds so everything works before you swap in your own:

- Up First from NPR: `https://feeds.npr.org/510318/podcast.xml`
- The Vergecast: `https://feeds.megaphone.fm/vergecast`

---

## Phase 1: Prove the RSS parsing works

This goes first because it is the riskiest unknown. If a feed is malformed or a field is missing, better to find out now than after a UI is built on top of it.

### Set up the project

```bash
pnpm create next-app@latest podcast-discovery --typescript --tailwind --app
cd podcast-discovery
pnpm add rss-parser
```

When the prompts ask, App Router: yes, `src/` directory: no (this tutorial assumes no `src/`, everything sits at the project root).

### Write `lib/rss.ts`

```typescript
import Parser from 'rss-parser'
import type { Episode } from './types'

const parser = new Parser()

// itunes:duration shows up as "1832" (raw seconds) on some feeds, and
// "27:15" or "1:05:30" on others. Normalize all three to seconds.
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
    .filter(item => item.enclosure?.url) // skip items with no audio (trailers, list episodes)
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
```

This imports a type from `./types` that does not exist yet. You will get a red squiggle until Phase 2, that is expected, TypeScript files are allowed to reference each other out of order as long as everything exists before you run the app for real.

Why `contentSnippet` and not `description`: `rss-parser` gives you both. `description`/`content` can carry raw HTML from the feed (bold tags, links). `contentSnippet` is the same text with HTML stripped, which is what you actually want to drop into a React component without it rendering broken markup.

Why `Promise` and `async`: `parser.parseURL` does a network fetch, which is asynchronous by nature. Anything that calls `parseFeed` has to `await` it or chain `.then()`.

### Test it before building anything else

Create a temporary route just to prove the function works, using the dev server you already have as the test harness:

```typescript
// app/api/test-rss/route.ts (temporary, delete after this check)
import { NextResponse } from 'next/server'
import { parseFeed } from '@/lib/rss'

export async function GET() {
  const episodes = await parseFeed(
    'https://feeds.npr.org/510318/podcast.xml',
    'up-first',
    'Up First from NPR',
    ['news']
  )
  return NextResponse.json(episodes.slice(0, 3))
}
```

This will also show a type error until `lib/types.ts` exists. Add the minimal version now (the full version comes in Phase 2):

```typescript
// lib/types.ts (minimal version for now)
export interface Episode {
  id: string
  feedId: string
  feedTitle: string
  title: string
  description: string
  audioUrl: string
  publishedAt: string
  durationSeconds: number
  tags: string[]
}
```

Run it:

```bash
pnpm dev
```

Visit `http://localhost:3000/api/test-rss`. You should see JSON with three real episodes: titles, descriptions, audio URLs, and `durationSeconds` as an actual number, not a string or `NaN`, even though the source feed's duration field is text.

**Done when:** real episode data prints out, and `durationSeconds` is a sensible number for every item. Delete `app/api/test-rss/route.ts` once confirmed, Phase 2 replaces it with the real thing.

---

## Phase 2: Get all your feeds into one list

### `lib/types.ts` (full version)

```typescript
export interface Feed {
  id: string
  title: string
  rssUrl: string
  tags: string[]
}

export interface Episode {
  id: string
  feedId: string
  feedTitle: string
  title: string
  description: string
  audioUrl: string
  publishedAt: string
  durationSeconds: number
  tags: string[]
}

export interface Rating {
  episodeId: string
  score: number // 1 to 5
  ratedAt: string
}

export interface SavedEpisode {
  episodeId: string
  savedAt: string
}
```

### `data/feeds.json`

```json
[
  {
    "id": "up-first",
    "title": "Up First from NPR",
    "rssUrl": "https://feeds.npr.org/510318/podcast.xml",
    "tags": ["news"]
  },
  {
    "id": "vergecast",
    "title": "The Vergecast",
    "rssUrl": "https://feeds.megaphone.fm/vergecast",
    "tags": ["tech"]
  }
]
```

Replace these with your own picks from "Before you start" once the app is working end to end. Keeping two feeds from different categories for now is deliberate, it is what makes the tag filter and recommendation engine in later phases visibly do something, one feed alone has nothing to distinguish.

### `app/api/sync-feeds/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { parseFeed } from '@/lib/rss'
import feedsData from '@/data/feeds.json'
import type { Episode, Feed } from '@/lib/types'

export async function GET() {
  const feeds = feedsData as Feed[]

  // allSettled instead of Promise.all: if one feed URL is down or malformed,
  // the sync should still return episodes from every feed that worked.
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
```

Common mistake to avoid: using `Promise.all` here instead of `Promise.allSettled`. With `Promise.all`, one dead feed URL throws and the entire sync returns nothing, for every feed, not just the broken one. `allSettled` isolates the failure.

**Test it:** visit `http://localhost:3000/api/sync-feeds`. You should get back `{ episodes: [...], errors: [] }` with episodes from both feeds mixed together, newest first.

**Done when:** episodes come back from every feed in `feeds.json`, not just the first one, and each episode carries the right tags from its own feed.

---

## Phase 3: Show episodes on the page

### `components/EpisodeCard.tsx`

```typescript
import type { Episode } from '@/lib/types'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function EpisodeCard({ episode }: { episode: Episode }) {
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-xs text-gray-500">{episode.feedTitle}</p>
          <h3 className="font-semibold leading-snug">{episode.title}</h3>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatDuration(episode.durationSeconds)}
        </span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{episode.description}</p>
      <a
        href={episode.audioUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 text-sm font-medium"
      >
        Play
      </a>
    </div>
  )
}
```

No `'use client'` directive here. This component has no state and no event handlers, it just takes data in and renders it, so it can stay a plain Server Component. That changes in Phase 5.

### `app/page.tsx` (replace the default content entirely)

```typescript
'use client'

import { useEffect, useState } from 'react'
import EpisodeCard from '@/components/EpisodeCard'
import type { Episode } from '@/lib/types'

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        setEpisodes(data.episodes)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load episodes. Check the feed URLs in data/feeds.json.')
        setLoading(false)
      })
  }, [])

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading episodes...</main>
  if (error) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Podcast Discovery</h1>
      <div className="space-y-4">
        {episodes.map(ep => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </main>
  )
}
```

This page needs `'use client'` because it uses `useState` and `useEffect`, both of which only run in the browser. `/api/sync-feeds` runs on the server (it is the one doing the RSS fetching), but the page that calls it runs on the client and simply asks the server for JSON, the same way it would ask any other API.

**Test it:** `pnpm dev`, open `http://localhost:3000`. You should see real episode cards from your real feeds, and clicking Play should open the actual audio file.

**Done when:** the app opens to real episodes, not placeholder text, and Play actually plays audio.

---

## Phase 4: Search

### `pnpm add fuse.js`

### `components/SearchBar.tsx`

```typescript
export default function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search episodes..."
      className="w-full border rounded-lg px-4 py-2 text-sm"
    />
  )
}
```

### `app/page.tsx` (full updated file)

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import EpisodeCard from '@/components/EpisodeCard'
import SearchBar from '@/components/SearchBar'
import type { Episode } from '@/lib/types'

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        setEpisodes(data.episodes)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load episodes. Check the feed URLs in data/feeds.json.')
        setLoading(false)
      })
  }, [])

  const fuse = useMemo(
    () => new Fuse(episodes, { keys: ['title', 'description'], threshold: 0.4 }),
    [episodes]
  )

  const filtered = query ? fuse.search(query).map(r => r.item) : episodes

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading episodes...</main>
  if (error) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Podcast Discovery</h1>
      <SearchBar value={query} onChange={setQuery} />
      <div className="mt-6 space-y-4">
        {filtered.length === 0 && <p className="text-gray-500 text-sm">No episodes match.</p>}
        {filtered.map(ep => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </main>
  )
}
```

Common mistake to avoid: writing `const fuse = new Fuse(episodes, ...)` directly in the component body without `useMemo`. That rebuilds the entire search index from scratch on every single render, including every keystroke in the search box. `useMemo(..., [episodes])` rebuilds it only when the episode list itself changes.

**Test it:** type a keyword, including one with a typo. Fuse's fuzzy matching should still surface the right episode.

**Done when:** search narrows the list correctly, and typos still find near matches.

---

## Phase 5: Ratings, stored locally

### `lib/ratings.ts`

```typescript
import type { Rating } from './types'

const KEY = 'podcast-discovery:ratings'

export function getRatings(): Rating[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}

export function getRating(episodeId: string): number | null {
  const existing = getRatings().find(r => r.episodeId === episodeId)
  return existing ? existing.score : null
}

export function setRating(episodeId: string, score: number): void {
  const ratings = getRatings().filter(r => r.episodeId !== episodeId)
  ratings.push({ episodeId, score, ratedAt: new Date().toISOString() })
  localStorage.setItem(KEY, JSON.stringify(ratings))
}
```

The `typeof window === 'undefined'` check matters: Next.js renders components on the server first, and `localStorage` does not exist there. Without this guard, the very first server render would crash.

### `components/RatingStars.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getRating, setRating } from '@/lib/ratings'

export default function RatingStars({ episodeId }: { episodeId: string }) {
  const [rating, setLocalRating] = useState<number | null>(null)

  useEffect(() => {
    setLocalRating(getRating(episodeId))
  }, [episodeId])

  function handleClick(score: number) {
    setRating(episodeId, score)
    setLocalRating(score)
  }

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          aria-label={`Rate ${star} stars`}
          className={star <= (rating ?? 0) ? 'text-yellow-500' : 'text-gray-300'}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

The rating is read inside `useEffect`, not directly during render. Reading `localStorage` during the initial render would return different results on the server (nothing) versus the client (the real value), which is exactly the kind of mismatch React's hydration checker flags as an error.

### `components/EpisodeCard.tsx` (full updated file, now a client component)

```typescript
'use client'

import type { Episode } from '@/lib/types'
import RatingStars from './RatingStars'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function EpisodeCard({ episode }: { episode: Episode }) {
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-xs text-gray-500">{episode.feedTitle}</p>
          <h3 className="font-semibold leading-snug">{episode.title}</h3>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatDuration(episode.durationSeconds)}
        </span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{episode.description}</p>
      <div className="flex justify-between items-center mt-2">
        <a
          href={episode.audioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm font-medium"
        >
          Play
        </a>
        <RatingStars episodeId={episode.id} />
      </div>
    </div>
  )
}
```

**Test it:** click a rating on any episode, refresh the page. The rating should still be there, it is sitting in your browser's localStorage now.

**Done when:** ratings survive a refresh.

---

## Phase 6: The recommendation engine

Start this only once you have rated 5 to 10 real episodes from Phase 5. Testing a recommender against zero ratings does not tell you it is broken, it just tells you nothing, there is no taste profile yet to score anything against.

Important correction from the build plan: this is not an API route. Your ratings live in `localStorage`, which only exists in the browser. A server-side API route has no access to it at all, so `/api/recommend/route.ts` as originally sketched would have nothing to read. The fix is simpler than the original plan anyway: since the computation is just array math, it runs directly in the page component, no network round trip needed.

### `lib/similarity.ts`

```typescript
import type { Episode, Rating } from './types'

// Every unique tag across all episodes becomes one dimension of the vector space.
export function buildTagUniverse(episodes: Episode[]): string[] {
  const tagSet = new Set<string>()
  episodes.forEach(ep => ep.tags.forEach(tag => tagSet.add(tag)))
  return Array.from(tagSet).sort()
}

export function tagsToVector(tags: string[], universe: string[]): number[] {
  return universe.map(tag => (tags.includes(tag) ? 1 : 0))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

export function buildTasteProfile(
  ratedEpisodes: { episode: Episode; score: number }[],
  universe: string[]
): number[] {
  const profile = Array(universe.length).fill(0)
  let totalWeight = 0

  ratedEpisodes.forEach(({ episode, score }) => {
    const vector = tagsToVector(episode.tags, universe)
    vector.forEach((val, i) => {
      profile[i] += val * score
    })
    totalWeight += score
  })

  if (totalWeight === 0) return profile
  return profile.map(val => val / totalWeight)
}

export function rankEpisodes(
  allEpisodes: Episode[],
  ratings: Rating[]
): (Episode & { score: number })[] {
  const universe = buildTagUniverse(allEpisodes)
  const ratingMap = new Map(ratings.map(r => [r.episodeId, r.score]))

  const ratedEpisodes = allEpisodes
    .filter(ep => ratingMap.has(ep.id))
    .map(ep => ({ episode: ep, score: ratingMap.get(ep.id)! }))

  const profile = buildTasteProfile(ratedEpisodes, universe)

  return allEpisodes
    .filter(ep => !ratingMap.has(ep.id))
    .map(ep => ({
      ...ep,
      score: cosineSimilarity(profile, tagsToVector(ep.tags, universe)),
    }))
    .sort((a, b) => b.score - a.score)
}
```

This is the same math from the README's worked example (a profile of `[0.82, 0.18, 0, 0.45, 0.36]` scoring a tech and science episode at about `0.88` and a comedy-only episode at about `0.18`), just generalized so the tag universe is built from whatever tags actually exist in your feeds instead of a fixed hardcoded list.

### `app/page.tsx` (full updated file, adds the For you / Latest toggle)

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import EpisodeCard from '@/components/EpisodeCard'
import SearchBar from '@/components/SearchBar'
import type { Episode } from '@/lib/types'
import { getRatings } from '@/lib/ratings'
import { rankEpisodes } from '@/lib/similarity'

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'latest' | 'forYou'>('latest')

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        setEpisodes(data.episodes)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load episodes. Check the feed URLs in data/feeds.json.')
        setLoading(false)
      })
  }, [])

  const fuse = useMemo(
    () => new Fuse(episodes, { keys: ['title', 'description'], threshold: 0.4 }),
    [episodes]
  )

  const ratings = useMemo(() => getRatings(), [episodes])

  const ranked = useMemo(() => {
    if (view !== 'forYou') return episodes
    const scored = rankEpisodes(episodes, ratings)
    return scored.length > 0 ? scored : episodes
  }, [view, episodes, ratings])

  const filtered = query ? fuse.search(query).map(r => r.item) : ranked

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading episodes...</main>
  if (error) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Podcast Discovery</h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setView('latest')}
            className={view === 'latest' ? 'font-semibold underline' : 'text-gray-500'}
          >
            Latest
          </button>
          <button
            type="button"
            onClick={() => setView('forYou')}
            className={view === 'forYou' ? 'font-semibold underline' : 'text-gray-500'}
          >
            For you
          </button>
        </div>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">
            {ratings.length === 0 && view === 'forYou'
              ? 'Rate a few episodes first, recommendations need something to work from.'
              : 'No episodes match.'}
          </p>
        )}
        {filtered.map(ep => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </main>
  )
}
```

**Test it:** rate 5 or so episodes that share a tag (all "tech", for instance), switch to "For you". Unrated tech episodes should now rank above unrated news episodes. Switch back to "Latest" to confirm plain date sorting still works too.

**Done when:** an unrated episode sharing tags with your highly rated episodes visibly ranks above one that shares none.

---

## Phase 7: Saving episodes

### `lib/saved.ts`

```typescript
import type { SavedEpisode } from './types'

const KEY = 'podcast-discovery:saved'

export function getSavedEpisodes(): SavedEpisode[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}

export function isSaved(episodeId: string): boolean {
  return getSavedEpisodes().some(s => s.episodeId === episodeId)
}

export function toggleSaved(episodeId: string): void {
  const saved = getSavedEpisodes()
  const exists = saved.some(s => s.episodeId === episodeId)
  const next = exists
    ? saved.filter(s => s.episodeId !== episodeId)
    : [...saved, { episodeId, savedAt: new Date().toISOString() }]
  localStorage.setItem(KEY, JSON.stringify(next))
}
```

### `components/EpisodeCard.tsx` (full updated file, final version)

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Episode } from '@/lib/types'
import RatingStars from './RatingStars'
import { isSaved, toggleSaved } from '@/lib/saved'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function EpisodeCard({ episode }: { episode: Episode }) {
  const [saved, setSavedState] = useState(false)

  useEffect(() => {
    setSavedState(isSaved(episode.id))
  }, [episode.id])

  function handleSave() {
    toggleSaved(episode.id)
    setSavedState(prev => !prev)
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-xs text-gray-500">{episode.feedTitle}</p>
          <h3 className="font-semibold leading-snug">{episode.title}</h3>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatDuration(episode.durationSeconds)}
        </span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{episode.description}</p>

      <div className="flex justify-between items-center mt-2">
        <a
          href={episode.audioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm font-medium"
        >
          Play
        </a>
        <div className="flex items-center gap-3">
          <RatingStars episodeId={episode.id} />
          <button type="button" onClick={handleSave} aria-label="Save episode" className="text-sm">
            {saved ? '★ Saved' : '☆ Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### `app/saved/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import EpisodeCard from '@/components/EpisodeCard'
import type { Episode } from '@/lib/types'
import { getSavedEpisodes } from '@/lib/saved'

export default function SavedPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        const savedIds = new Set(getSavedEpisodes().map(s => s.episodeId))
        const all: Episode[] = data.episodes
        setEpisodes(all.filter(ep => savedIds.has(ep.id)))
        setLoading(false)
      })
  }, [])

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading...</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Saved episodes</h1>
      {episodes.length === 0 && (
        <p className="text-gray-500 text-sm">
          Nothing saved yet. Save an episode from the home page to see it here.
        </p>
      )}
      <div className="space-y-4">
        {episodes.map(ep => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </main>
  )
}
```

**Test it:** save an episode from the home page, visit `http://localhost:3000/saved`. It should be there.

**Done when:** a saved episode from the home page shows up again on `/saved`, and unsaving removes it.

---

## Phase 8: Tag filtering and polish

### `components/TagFilter.tsx`

```typescript
export default function TagFilter({
  tags,
  active,
  onSelect,
}: {
  tags: string[]
  active: string | null
  onSelect: (tag: string | null) => void
}) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-xs border ${
          active === null ? 'bg-black text-white' : 'bg-white text-gray-700'
        }`}
      >
        All
      </button>
      {tags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className={`px-3 py-1 rounded-full text-xs border ${
            active === tag ? 'bg-black text-white' : 'bg-white text-gray-700'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
```

### `app/page.tsx` (full updated file, final version)

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import EpisodeCard from '@/components/EpisodeCard'
import SearchBar from '@/components/SearchBar'
import TagFilter from '@/components/TagFilter'
import type { Episode } from '@/lib/types'
import { getRatings } from '@/lib/ratings'
import { rankEpisodes } from '@/lib/similarity'

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [view, setView] = useState<'latest' | 'forYou'>('latest')

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        setEpisodes(data.episodes)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load episodes. Check the feed URLs in data/feeds.json.')
        setLoading(false)
      })
  }, [])

  const allTags = useMemo(
    () => Array.from(new Set(episodes.flatMap(ep => ep.tags))).sort(),
    [episodes]
  )

  const fuse = useMemo(
    () => new Fuse(episodes, { keys: ['title', 'description'], threshold: 0.4 }),
    [episodes]
  )

  const ratings = useMemo(() => getRatings(), [episodes])

  const ranked = useMemo(() => {
    if (view !== 'forYou') return episodes
    const scored = rankEpisodes(episodes, ratings)
    return scored.length > 0 ? scored : episodes
  }, [view, episodes, ratings])

  const searched = query ? fuse.search(query).map(r => r.item) : ranked
  const filtered = activeTag ? searched.filter(ep => ep.tags.includes(activeTag)) : searched

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading episodes...</main>
  if (error) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Podcast Discovery</h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setView('latest')}
            className={view === 'latest' ? 'font-semibold underline' : 'text-gray-500'}
          >
            Latest
          </button>
          <button
            type="button"
            onClick={() => setView('forYou')}
            className={view === 'forYou' ? 'font-semibold underline' : 'text-gray-500'}
          >
            For you
          </button>
        </div>
      </div>

      <SearchBar value={query} onChange={setQuery} />
      <TagFilter tags={allTags} active={activeTag} onSelect={setActiveTag} />

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">
            {ratings.length === 0 && view === 'forYou'
              ? 'Rate a few episodes first, recommendations need something to work from.'
              : 'No episodes match.'}
          </p>
        )}
        {filtered.map(ep => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </main>
  )
}
```

This is the last version of `app/page.tsx`, everything from here is either done or happens in `data/feeds.json` and CSS tweaks.

**Test it:** click a tag chip, confirm the list narrows to only that tag, and that it composes correctly with search and the For you / Latest toggle (all three filters should stack, not override each other).

**Done when:** the app feels usable day to day: tags, search, ratings, and saves all work together without fighting each other.

---

## Phase 9: Ship it

### Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new repository on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/podcast-discovery.git
git branch -M main
git push -u origin main
```

### Deploy to Vercel

Import the repository at vercel.com, no configuration needed, Next.js is auto-detected. Deploy.

### Automate the feed sync

Add `vercel.json` at the project root:

```json
{
  "crons": [
    {
      "path": "/api/sync-feeds",
      "schedule": "0 8 * * *"
    }
  ]
}
```

One real constraint worth knowing before you write a schedule: on Vercel's free Hobby plan, cron jobs are capped at once per day, an expression that would fire more often fails at deploy time, and the exact minute is not guaranteed, only the hour. `"0 8 * * *"` runs once daily, sometime in the 8am UTC hour, which is fine here since `/api/sync-feeds` already re-parses everything fresh on every call, this cron entry is just there so it happens automatically instead of only when someone visits the site.

If you would rather reuse the cron-triggered sync worker pattern from your other side project instead of Vercel's built-in cron, a Cloudflare Worker on a schedule calls the same route just as well, hit the deployed URL's `/api/sync-feeds` endpoint from the worker instead of running it inside Vercel.

### Optional: lock the sync route down

Right now `/api/sync-feeds` is a public URL, anyone who finds it can call it. That is a low-stakes risk for a two-feed personal project, but if you want to close it off, Vercel automatically sets a `CRON_SECRET` environment variable when cron is configured, and sends it as an `Authorization` header on scheduled invocations:

```typescript
// app/api/sync-feeds/route.ts, updated GET signature and an early check
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ...rest of the function is unchanged
}
```

With this in place, requests without the right header get a 401. Your own browser calling `/api/sync-feeds` directly during development will also get a 401 once `CRON_SECRET` is set in your environment, which is expected, only Vercel's scheduler knows the value in production.

**Test it:** visit your live Vercel URL. Episodes should load exactly like they did on localhost.

**Done when:** the live URL shows fresh episodes without you touching localhost, and stays fresh on its own via the scheduled sync.

---

## If something breaks

- **A feed returns nothing:** open `/api/sync-feeds` directly and check the `errors` array in the response, it names which feed failed and why.
- **A 403 fetching a specific feed:** some podcast hosts block requests that do not look like they come from a browser. Pass a `headers` option to the `Parser` constructor in `lib/rss.ts`: `new Parser({ headers: { 'User-Agent': 'Mozilla/5.0' } })`.
- **Ratings or saves disappear:** they are keyed by episode ID (`${feedId}-${guid}`), if a feed's GUIDs change between syncs, old ratings will not match new episode IDs. This is rare but not impossible on some feeds.
- **A hydration error mentioning localStorage or window:** something is reading `localStorage` outside of `useEffect` or an event handler. Every localStorage read in this tutorial is wrapped that way on purpose, check any new code you add follows the same pattern.
