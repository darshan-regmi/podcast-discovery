# Build Plan: Podcast Discovery Engine

This is the quick-reference checklist. For full working code at every step, see `TUTORIAL.md`.

One line framing: build a thin vertical slice first, add one capability at a time, and do not touch the recommendation engine or Firestore until there is real data to test them against.

You can deploy to Vercel as early as Phase 3 if you want to test on your phone as you go. Moving Phase 9's deploy steps earlier costs nothing.

## Before you start

- [x] Pick 5 to 10 podcasts you actually listen to (see Notes to self in the README, this matters more than it sounds)
      _Currently using the two sample feeds from the tutorial, Up First and The Vergecast._
- [ ] Confirm each one has a working RSS feed URL, search "[podcast name] rss feed" if it is not obvious from the podcast's own website

## Phase 1: Prove the RSS parsing works

This is the riskiest unknown, so it goes first. If a feed is malformed or missing fields, better to find out before a UI is built on top of it.

- [x] `pnpm create next-app@latest . --ts --tailwind --app`
- [x] `pnpm add rss-parser`
- [x] Write `lib/rss.ts` with a single function that takes one RSS URL and returns parsed episodes
- [x] Hardcode one feed URL, call the function, `console.log` the result

Done when: real episode titles, descriptions, and audio URLs print out for one feed.

```typescript
// lib/rss.ts - first pass, just to prove parsing works
import Parser from 'rss-parser'

const parser = new Parser()

export async function parseFeed(url: string) {
  const feed = await parser.parseURL(url)
  return feed.items.map(item => ({
    title: item.title,
    description: item.contentSnippet,
    audioUrl: item.enclosure?.url,
    publishedAt: item.pubDate,
  }))
}
```

## Phase 2: Get all your feeds into one list

- [x] Create `data/feeds.json` with your real feed URLs (format in README section 9)
- [x] Add `lib/types.ts` with the `Feed` and `Episode` interfaces (README section 7)
- [x] Build `/api/sync-feeds/route.ts`: loop over `feeds.json`, parse each one, combine into one array
- [x] Hit the route in the browser, confirm episodes come back from every feed, not just the first one

Done when: `/api/sync-feeds` returns a single JSON array with episodes from all your feeds, each one tagged with its feed's category.

## Phase 3: Show episodes on the page

- [x] Build `EpisodeCard.tsx`: title, show name, description, publish date, a play link to the audio URL
- [x] Build the home page (`app/page.tsx`): fetch from `/api/sync-feeds`, render a list of `EpisodeCard`
- [x] Sort by publish date for now, newest first, there is no ranking yet

Done when: the app opens to real episodes from your real feeds, and clicking play actually plays audio.

## Phase 4: Search

- [x] `pnpm add fuse.js`
- [x] Build `SearchBar.tsx`
- [x] Wire Fuse.js to search across title and description, filtering the episode list client side as the user types

Done when: typing a keyword narrows the list to matching episodes, including near matches for typos.

## Phase 5: Ratings, stored locally

- [x] Build `RatingStars.tsx`, a 1 to 5 click interface
- [x] On rating, write to localStorage keyed by episode ID (`Rating` shape from README section 7)
- [x] Show the current rating on `EpisodeCard` if one already exists

Done when: rating an episode, refreshing the page, and the rating is still there.

## Phase 6: The recommendation engine

Start this only once there are at least 5 to 10 real ratings sitting in localStorage. Testing a recommender against zero data does not tell you it is broken, it just tells you nothing.

- [x] Build `lib/similarity.ts` with `cosineSimilarity` and a `buildTasteProfile` function (README section 5.3 has the full math and the function)
- [x] Call it directly from the home page, not from an API route: ratings live in localStorage, which only exists in the browser, so a server-side route has nothing to read. Ranking is just a function call in the component.
- [x] On the home page, add a toggle or a second section: "For you" sorted by score, "Latest" sorted by date

Done when: an episode sharing tags with your highly rated episodes visibly ranks above one that does not.

## Phase 7: Saving episodes

- [x] Add a bookmark button to `EpisodeCard`
- [x] Store saved episode IDs in localStorage
- [x] Build `app/saved/page.tsx` to list them

Done when: an episode saved from the home page shows up again on `/saved`.

## Phase 8: Tag filtering and polish

- [x] Build `TagFilter.tsx`, a row of toggleable tag chips above the episode list
- [x] Add loading and empty states: no episodes yet, no search results, no ratings yet for recommendations
- [x] Pass over spacing, typography, and mobile layout now that the functionality is proven

Done when: the app feels usable day to day, not just correct in a demo.

## Phase 9: Ship it

- [ ] Push to GitHub (repo initialized locally, no remote yet)
- [ ] Deploy to Vercel
- [ ] Set up a scheduled job, Vercel cron or a Cloudflare Worker (README section 4), to hit `/api/sync-feeds` automatically instead of relying on manual triggers

Done when: the live URL shows fresh episodes without touching localhost.

## Later, not now

Firestore migration, transcripts, sharing, embeddings based recommendations. All of these live in the Roadmap section of the README. None belong in v1. Adding them earlier than this only delays finding out whether the core idea, rating a handful of episodes and getting good recommendations back, actually works for you.
