'use client'

import { useSyncExternalStore } from 'react'
import type { SavedEpisode } from './types'
import { getVersion, notify, subscribe } from './store'

const KEY = 'podcast-discovery:saved'
const EMPTY: SavedEpisode[] = []
const EMPTY_IDS: string[] = []

let cache: { version: number; data: SavedEpisode[]; ids: string[] } | null = null

function read(): { data: SavedEpisode[]; ids: string[] } {
  if (typeof window === 'undefined') return { data: EMPTY, ids: EMPTY_IDS }

  const current = getVersion()
  if (cache && cache.version === current) return cache

  const raw = localStorage.getItem(KEY)
  let data: SavedEpisode[] = EMPTY

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) data = parsed as SavedEpisode[]
    } catch {
      data = EMPTY
    }
  }

  cache = { version: current, data, ids: data.map(s => s.episodeId) }
  return cache
}

export function getSavedEpisodes(): SavedEpisode[] {
  return read().data
}

export function isSaved(episodeId: string): boolean {
  return read().ids.includes(episodeId)
}

export function toggleSaved(episodeId: string): void {
  const current = read().data
  const exists = current.some(s => s.episodeId === episodeId)
  const next = exists
    ? current.filter(s => s.episodeId !== episodeId)
    : [...current, { episodeId, savedAt: new Date().toISOString() }]
  localStorage.setItem(KEY, JSON.stringify(next))
  notify()
}

export function useSavedIds(): string[] {
  return useSyncExternalStore(subscribe, () => read().ids, () => EMPTY_IDS)
}

export function useIsSaved(episodeId: string): boolean {
  return useSavedIds().includes(episodeId)
}
