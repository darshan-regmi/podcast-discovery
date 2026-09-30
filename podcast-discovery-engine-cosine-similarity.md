# Podcast Discovery Engine: How Cosine Similarity Recommendations Work

## TL;DR

The app recommends episodes by turning "your taste" and "each episode's tags" into arrows (vectors) of numbers, then checking how closely those arrows point in the same direction. Same direction, strong match. Different direction, weak match. This is called **cosine similarity**, and the overall approach is **content-based filtering**: recommending based on item tags and your own rating history, not on what other users liked, since a new app has no other users' data to lean on yet.

## Part 1: Two lists, keep them separate

Two lists exist in this system, and mixing them up caused most of the bugs in this conversation.

### allTags

Every tag that has ever appeared, across every episode, in the whole database. Duplicates collapsed. Not tied to any single user.

```
allTags = [tech, business, comedy, science, murder, crime]
```

Grows automatically. The moment any episode introduces a tag that's never existed before, it gets appended:

```
allTags = [tech, business, comedy, science, murder, crime, romance]
```

`allTags` sets the length and order of every vector in the system. It's the ruler everything else gets measured against.

### preferredTags

The specific tags one user picked, usually at signup ("pick your top 10 interests"). Per-user. Does not auto-grow. Only changes if the user manually edits it.

```
user.preferredTags = [tech, business, comedy, science, murder, crime]
```

This is a cold-start seed, a guess at taste before any ratings exist yet. It stays untouched even after `allTags` grows, unless the user edits it themselves.

## Part 2: Turning tags into vectors

Every episode becomes a one-hot vector: 1 if it has a tag, 0 if it doesn't, always in the same order as `allTags`.

```
allTags: [tech, business, comedy, science, murder, crime]

ep1, tagged [tech, business]          → [1, 1, 0, 0, 0, 0]
ep2, tagged [comedy]                  → [0, 0, 1, 0, 0, 0]
ep3, tagged [crime, science, murder]  → [0, 0, 0, 1, 1, 1]
```

**The rule that matters most:** every vector, always, gets built against the current, full `allTags` list. Same length, same order, every time.

### Mistake #1 (the one that actually happened)

`ep1` and `ep2` got built as 5-slot vectors before `crime` existed as a tag. Then `ep3` came along, introduced `crime`, and became a 6-slot vector. All three got added together directly:

```
WRONG
ep1: [1,1,0,0,0]      5 slots
ep2: [0,0,1,0,0]      5 slots
ep3: [0,0,0,1,1,1]    6 slots
```

Adding these position by position doesn't mean anything, the slots don't line up between vectors.

**The fix:** lock `allTags` first, then rebuild every vector, including the old ones, against that full list. `ep1` and `ep2` need a trailing 0 added for `crime`, since neither episode has that tag.

```
RIGHT
allTags: [tech, business, comedy, science, murder, crime]
ep1: [1,1,0,0,0,0]
ep2: [0,0,1,0,0,0]
ep3: [0,0,0,1,1,1]
```

Now position 0 always means "tech," no matter which vector you're looking at, and adding vectors together position by position actually makes sense.

## Part 3: Building the taste profile (vector A)

The profile is a rating-weighted average of every episode a user has rated. Higher-rated episodes pull the average harder toward their tags.

```
profile = (rating₁ × vector₁ + rating₂ × vector₂ + ...) / (rating₁ + rating₂ + ...)
```

### Worked example

```
ep1 [1,1,0,0,0,0]  rating 3
ep2 [0,0,1,0,0,0]  rating 5
ep3 [0,0,0,1,1,1]  rating 5

3 × [1,1,0,0,0,0] = [3,3,0,0,0,0]
5 × [0,0,1,0,0,0] = [0,0,5,0,0,0]
5 × [0,0,0,1,1,1] = [0,0,0,5,5,5]

sum          = [3,3,5,5,5,5]
total rating = 3 + 5 + 5 = 13

profile = [3,3,5,5,5,5] / 13
        = [0.23, 0.23, 0.38, 0.38, 0.38, 0.38]
```

Read this vector as relative pull, not percentages that sum to 100: 23% weight toward tech, 23% toward business, 38% each toward comedy, science, murder, and crime.

Before any ratings exist, seed this same vector from `preferredTags` instead: small equal weight on each preferred tag, 0 everywhere else. Once real ratings start coming in, they're what actually drives the profile from that point forward.

## Part 4: Scoring a candidate episode with cosine similarity

Picture two arrows starting from the same point. Cosine similarity asks one question: how close is the angle between them?

- Same direction → score near 1 → strong match
- 90° apart, nothing in common → score near 0 → no match

```
cos(θ) = (A · B) / (‖A‖ × ‖B‖)
```

- **A** = the user's profile vector, fixed for a given moment (from Part 3)
- **B** = the candidate episode's vector, changes for every episode being scored
- **A · B** = the dot product, measures overlap
- **‖A‖**, **‖B‖** = the length (magnitude) of each vector, cancels out size differences

### Dot product: multiply matching positions, add them up

```
A = [0.23, 0.23, 0.38, 0.38, 0.38, 0.38]
B = [0, 0, 0, 1, 1, 1]     (episode tagged science, murder, crime)

dot = 0.23×0 + 0.23×0 + 0.38×0 + 0.38×1 + 0.38×1 + 0.38×1
    = 0 + 0 + 0 + 0.38 + 0.38 + 0.38
    = 1.14
```

Every slot where B is 0 erases that part of A from the sum. Only genuine overlap survives.

### Magnitude: how long is the vector

Same idea as the Pythagorean theorem, extended past two dimensions: square every number, add them up, take the square root.

```
‖A‖ = √(0.23² + 0.23² + 0.38² + 0.38² + 0.38² + 0.38²)
    = √(0.0529 + 0.0529 + 0.1444 + 0.1444 + 0.1444 + 0.1444)
    = √0.6834
    ≈ 0.83

‖B‖ = √(0² + 0² + 0² + 1² + 1² + 1²)
    = √3
    ≈ 1.73
```

Zeros are free since 0² = 0, they never add anything to the sum.

### Divide

```
cos(θ) = 1.14 / (0.83 × 1.73)
       ≈ 1.14 / 1.44
       ≈ 0.79
```

Score about 0.79, a strong match. This episode leans heavily into exactly the tags the profile is weighted toward.

### Mistake #2 (the one that actually happened)

At one point the dot product got computed using one episode's tags (tech, business, science), but ‖B‖ got computed using a different episode's tags (all six tags on). That breaks the formula, it's like measuring one person's height and dividing by someone else's shoe size.

**The rule:** the dot product and ‖B‖ must always come from the exact same episode vector. Only ‖A‖ stays constant across calculations, since it's always the same user profile. Everything involving B, both the dot product and ‖B‖, has to be recomputed together, per episode, every time.

### One more subtlety worth remembering

An extra tag the profile has no signal for doesn't just fail to help, it can actively lower the score. It adds to ‖B‖ (makes the vector "longer") without adding anything to the dot product. So an episode tagged only `[comedy]` can outscore one tagged `[comedy, romance]` against the same profile, even though both share the exact same relevant overlap, if the profile has zero weight on romance.

## Part 5: What happens as the system grows

**When a rating comes in:** update the profile (vector A) right away. Cheap, it's just a weighted-average recalculation.

**When a new tag appears in allTags:** every vector in the system technically needs a new 0 appended for that slot. A missing trailing 0 behaves identically to an explicit one in every formula here, it contributes nothing to the dot product or the magnitude either way, so there's no need to rewrite every stored vector the instant a tag appears. Build vectors fresh, against the current `allTags`, at the moment they're actually needed.

**When recommendations are requested:** this is the only moment cosine similarity actually needs computing. Score every unrated episode's vector against the current profile, sort by score, show the top results. No need to precompute or store similarity scores in advance, and no need to recompute anything the instant a rating or tag changes, only when someone is about to see a recommendation list.

## Part 6: The full flow, start to finish

1. **User signs up.** Picks `preferredTags` from the current `allTags` list. This seeds a starting profile vector: small weight on those tags, 0 everywhere else.
2. **Episodes exist in the system**, each with its own tags. Any tag never seen before gets appended to `allTags` automatically, independent of any user.
3. **User rates an episode.** Build that episode's vector against the current `allTags`. Fold it into the weighted-average profile calculation. Vector A updates immediately.
4. **User requests recommendations.** For every unrated episode:
   - Build its vector B against the current `allTags`
   - Compute `A · B`
   - Compute `‖A‖` and `‖B‖` (from that same B)
   - Compute `cos(θ) = (A · B) / (‖A‖ × ‖B‖)`
5. **Sort every scored episode by cos(θ), highest first.** That ranked list is the recommendations.
6. **Repeat step 3 onward** as the user rates more things. The profile keeps shifting toward whatever they actually rate highly. `preferredTags` matters less and less as real rating data builds up.

## Mistakes made in this conversation, summarized

| Mistake | What went wrong | Fix |
|---|---|---|
| Adding vectors of different lengths | Episode vectors got built before `allTags` was locked to a fixed length | Always build every vector against the current, full `allTags` list |
| Mixing dot product and ‖B‖ from different episodes | Dot product used one episode's tags, ‖B‖ used a different episode's tags | Dot product and ‖B‖ must always come from the identical B |
| Assuming suggestions get filtered by preferredTags | Thought only episodes matching preferredTags should be shown | Score every unrated episode and let cos(θ) rank them, don't pre-filter by tag list |

## Quick reference

```
cos(θ) = (A · B) / (‖A‖ × ‖B‖)

A · B  = sum of A[i] × B[i], for every position i
‖V‖    = √(sum of V[i]², for every position i)
```

```typescript
function toVector(itemTags: string[], allTags: string[]): number[] {
  return allTags.map(tag => itemTags.includes(tag) ? 1 : 0);
}

function buildProfile(
  ratedEpisodes: { vector: number[]; rating: number }[],
  vectorLength: number
): number[] {
  const totals = new Array(vectorLength).fill(0);
  let totalRating = 0;

  for (const { vector, rating } of ratedEpisodes) {
    vector.forEach((v, i) => { totals[i] += v * rating; });
    totalRating += rating;
  }

  return totals.map(t => t / totalRating);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function recommend(
  profile: number[],
  candidates: { id: string; vector: number[] }[],
  topN = 10
) {
  return candidates
    .map(ep => ({ id: ep.id, score: cosineSimilarity(profile, ep.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
```
