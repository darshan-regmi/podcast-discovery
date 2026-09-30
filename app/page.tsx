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
