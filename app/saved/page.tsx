'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EpisodeCard from '@/components/EpisodeCard'
import type { Episode } from '@/lib/types'
import { useSavedIds } from '@/lib/saved'

export default function SavedPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const savedIds = useSavedIds()

  useEffect(() => {
    fetch('/api/sync-feeds')
      .then(res => res.json())
      .then(data => {
        const wanted = new Set(savedIds)
        setEpisodes((data.episodes as Episode[]).filter(ep => wanted.has(ep.id)))
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load episodes. Check the feed URLs in data/feeds.json.')
        setLoading(false)
      })
  }, [savedIds])

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading...</main>
  if (error) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Saved episodes</h1>
        <Link href="/" className="text-sm text-gray-500">
          Back to browse
        </Link>
      </div>
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
