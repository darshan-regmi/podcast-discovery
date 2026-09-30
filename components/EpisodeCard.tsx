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
