import type { Metadata } from 'next'
import EpisodeBrowser from '@/components/EpisodeBrowser'
import { getAllEpisodes } from '@/lib/feeds'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

// Feeds change slowly; render once and refresh hourly instead of on every hit.
export const revalidate = 3600

// Feeds can hold 1500+ episodes. Render a recent slice for crawlers and fast
// first paint; the browser then loads the full archive for search (see
// EpisodeBrowser).
const SERVER_EPISODE_LIMIT = 60

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export default async function Home() {
  // Fetched on the server so the episode list is in the initial HTML rather
  // than a "Loading episodes..." placeholder.
  const { episodes, errors } = await getAllEpisodes()

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      ...(episodes.length > 0
        ? [
            {
              '@type': 'ItemList',
              itemListElement: episodes.slice(0, 25).map((episode, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                  '@type': 'PodcastEpisode',
                  name: episode.title,
                  description: episode.description.slice(0, 300),
                  datePublished: episode.publishedAt,
                  partOfSeries: {
                    '@type': 'PodcastSeries',
                    name: episode.feedTitle,
                  },
                  associatedMedia: {
                    '@type': 'AudioObject',
                    contentUrl: episode.audioUrl,
                  },
                },
              })),
            },
          ]
        : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <EpisodeBrowser
        initialEpisodes={episodes.slice(0, SERVER_EPISODE_LIMIT)}
        errors={errors}
      />
    </>
  )
}
