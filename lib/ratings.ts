'use client'

import { useSyncExternalStore } from 'react'
import type { Rating } from './types'
import { getVersion, notify, subscribe } from './store'

const KEY = 'podcast-discovery:ratings'
const EMPTY: Rating[] = []

let cache: { version: number; data: Rating[] } | null = null

function read(): Rating[] {
  if (typeof window === 'undefined') return EMPTY

  const current = getVersion()
  if (cache && cache.version === current) return cache.data

  const raw = localStorage.getItem(KEY)
  let data: Rating[] = EMPTY

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) data = parsed as Rating[]
    } catch {
      data = EMPTY
    }
  }

  cache = { version: current, data }
  return data
}

export function getRatings(): Rating[] {
  return read()
}

export function getRating(episodeId: string): number | null {
  return read().find(r => r.episodeId === episodeId)?.score ?? null
}

export function setRating(episodeId: string, score: number): void {
  const next = read().filter(r => r.episodeId !== episodeId)
  next.push({ episodeId, score, ratedAt: new Date().toISOString() })
  localStorage.setItem(KEY, JSON.stringify(next))
  notify()
}

export function useRatings(): Rating[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function useRating(episodeId: string): number | null {
  const ratings = useRatings()
  return ratings.find(r => r.episodeId === episodeId)?.score ?? null
}
