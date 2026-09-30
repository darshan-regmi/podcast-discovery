import type { Episode, Rating } from './types'

export function buildTagUniverse(episodes: Episode[]): string[] {
  const tagSet = new Set<string>()
  episodes.forEach(ep => ep.tags.forEach(tag => tagSet.add(tag)))
  return Array.from(tagSet).sort()
}

export function tagsToVector(tags: string[], universe: string[]): number[] {
  return universe.map(tag => (tags.includes(tag) ? 1 : 0))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

export function buildTasteProfile(
  ratedEpisodes: { episode: Episode; score: number }[],
  universe: string[]
): number[] {
  const profile = Array(universe.length).fill(0)
  let totalWeight = 0

  ratedEpisodes.forEach(({ episode, score }) => {
    const vector = tagsToVector(episode.tags, universe)
    vector.forEach((val, i) => {
      profile[i] += val * score
    })
    totalWeight += score
  })

  if (totalWeight === 0) return profile
  return profile.map(val => val / totalWeight)
}

export function rankEpisodes(
  allEpisodes: Episode[],
  ratings: Rating[]
): (Episode & { score: number })[] {
  const universe = buildTagUniverse(allEpisodes)
  const ratingMap = new Map(ratings.map(r => [r.episodeId, r.score]))

  const ratedEpisodes = allEpisodes
    .filter(ep => ratingMap.has(ep.id))
    .map(ep => ({ episode: ep, score: ratingMap.get(ep.id)! }))

  const profile = buildTasteProfile(ratedEpisodes, universe)

  return allEpisodes
    .filter(ep => !ratingMap.has(ep.id))
    .map(ep => ({
      ...ep,
      score: cosineSimilarity(profile, tagsToVector(ep.tags, universe)),
    }))
    .sort((a, b) => b.score - a.score)
}
