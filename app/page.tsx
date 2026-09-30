'use client'

import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import EpisodeCard from '@/components/EpisodeCard'
import SearchBar from '@/components/SearchBar'
import type { Episode } from '@/lib/types'
import { useRatings } from '@/lib/ratings'
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

  const ratings = useRatings()

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
