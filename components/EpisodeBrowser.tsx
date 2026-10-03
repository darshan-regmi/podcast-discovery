'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Fuse from 'fuse.js'
import EpisodeCard from '@/components/EpisodeCard'
import SearchBar from '@/components/SearchBar'
import TagFilter from '@/components/TagFilter'
import type { Episode } from '@/lib/types'
import { useRatings } from '@/lib/ratings'
import { rankEpisodes } from '@/lib/similarity'

interface EpisodeBrowserProps {
  /** Newest episodes, rendered on the server so the list is in the HTML. */
  initialEpisodes: Episode[]
  /** Per-feed fetch failures from the server render, if any. */
  errors: string[]
}

export default function EpisodeBrowser({ initialEpisodes, errors }: EpisodeBrowserProps) {
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes)
  const [fetchErrors, setFetchErrors] = useState<string[]>(errors)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [view, setView] = useState<'latest' | 'forYou'>('latest')

  // The server renders a recent slice (feeds can hold 1500+ episodes, which
  // would make a multi-megabyte document). Pull the full archive in the
  // browser so search and "For you" still cover every episode.
  useEffect(() => {
    let cancelled = false

    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (Array.isArray(data.episodes)) setEpisodes(data.episodes)
        if (Array.isArray(data.errors)) setFetchErrors(data.errors)
      })
      .catch(() => {
        // Keep the server-rendered slice; the page stays usable offline.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const allTags = useMemo(
    () => Array.from(new Set(episodes.flatMap(ep => ep.tags))).sort(),
    [episodes]
  )

  const fuse = useMemo(
    () => new Fuse(episodes, { keys: ['title', 'description'], threshold: 0.4 }),
    [episodes]
  )

  const ratings = useRatings()

  const ranked = useMemo(() => {
    if (view !== 'forYou') return episodes
    const scored = rankEpisodes(episodes, ratings)
    return scored.length > 0 ? scored : episodes
  }, [view, episodes, ratings])

  const searched = query ? fuse.search(query).map(r => r.item) : ranked
  const filtered = activeTag ? searched.filter(ep => ep.tags.includes(activeTag)) : searched

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Podcast Discovery</h1>
        <div className="flex gap-4 items-center text-sm">
          <Link href="/saved" className="text-gray-500">
            Saved
          </Link>
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

      {fetchErrors.length > 0 && (
        <p className="text-sm text-amber-600 mt-4">
          Some feeds could not be loaded: {fetchErrors.join('; ')}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">
            {episodes.length === 0
              ? 'No episodes yet. Check the feed URLs in data/feeds.json.'
              : ratings.length === 0 && view === 'forYou'
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
