export interface Feed {
  id: string
  title: string
  rssUrl: string
  tags: string[]
}

export interface Episode {
  id: string
  feedId: string
  feedTitle: string
  title: string
  description: string
  audioUrl: string
  publishedAt: string
  durationSeconds: number
  tags: string[]
}

export interface Rating {
  episodeId: string
  score: number
  ratedAt: string
}

export interface SavedEpisode {
  episodeId: string
  savedAt: string
}
