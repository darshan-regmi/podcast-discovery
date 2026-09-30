'use client'

import type { Episode } from '@/lib/types'
import RatingStars from './RatingStars'
import { toggleSaved, useIsSaved } from '@/lib/saved'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function EpisodeCard({ episode }: { episode: Episode }) {
  const saved = useIsSaved(episode.id)

  function handleSave() {
    toggleSaved(episode.id)
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
