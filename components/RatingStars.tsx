'use client'

import { setRating, useRating } from '@/lib/ratings'

export default function RatingStars({ episodeId }: { episodeId: string }) {
  const rating = useRating(episodeId)

  function handleClick(score: number) {
    setRating(episodeId, score)
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
