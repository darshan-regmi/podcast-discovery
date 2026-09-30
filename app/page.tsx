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
