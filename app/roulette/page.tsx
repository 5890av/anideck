'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Dices,
  Eye,
  Flame,
  Heart,
  Layers,
  Play,
  RotateCw,
  Skull,
  Sparkles,
  Star,
  Tv,
  Zap,
} from 'lucide-react'
import { anilist, displayTitle, formatEnum, type MediaCard } from '@/lib/anilist'
import { addToWatchlist, updateEntry, useWatchlist } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

const ROULETTE_QUERY = `
  query RoulettePool(
    $page: Int
    $genre_in: [String]
    $episodes_lesser: Int
    $averageScore_greater: Int
    $popularity_lesser: Int
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: 30) {
      media(
        type: ANIME
        isAdult: false
        genre_in: $genre_in
        episodes_lesser: $episodes_lesser
        averageScore_greater: $averageScore_greater
        popularity_lesser: $popularity_lesser
        sort: $sort
      ) {
        id
        title { romaji english }
        coverImage { large medium color }
        bannerImage
        format
        status
        episodes
        seasonYear
        averageScore
        genres
        description(asHtml: false)
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`

type RouletteMedia = MediaCard & {
  bannerImage?: string | null
  description?: string | null
}

type MoodPreset = {
  id: string
  label: string
  tagline: string
  icon: typeof Flame
  source: 'watchlist' | 'anilist'
  variables?: Record<string, unknown>
}

const MOODS: MoodPreset[] = [
  {
    id: 'watchlist',
    label: 'My Plan to Watch',
    tagline: 'Pick a winner from your own backlog',
    icon: Layers,
    source: 'watchlist',
  },
  {
    id: 'dark-action',
    label: 'Late-Night Dark Action',
    tagline: 'High-stakes intensity & grit',
    icon: Skull,
    source: 'anilist',
    variables: {
      genre_in: ['Action', 'Thriller', 'Psychological'],
      averageScore_greater: 76,
      sort: ['POPULARITY_DESC'],
    },
  },
  {
    id: 'weekend-binge',
    label: 'Weekend Binge (≤13 Eps)',
    tagline: 'Tight, complete 1-season stories',
    icon: Zap,
    source: 'anilist',
    variables: {
      episodes_lesser: 14,
      averageScore_greater: 78,
      sort: ['SCORE_DESC'],
    },
  },
  {
    id: 'hidden-gems',
    label: 'Hidden Gems (80%+)',
    tagline: 'Critically acclaimed sleeper hits',
    icon: Sparkles,
    source: 'anilist',
    variables: {
      averageScore_greater: 80,
      popularity_lesser: 95000,
      sort: ['SCORE_DESC'],
    },
  },
  {
    id: 'adrenaline',
    label: 'Pure Adrenaline',
    tagline: 'Non-stop battles & epic worlds',
    icon: Flame,
    source: 'anilist',
    variables: {
      genre_in: ['Action', 'Adventure', 'Fantasy'],
      averageScore_greater: 78,
      sort: ['TRENDING_DESC'],
    },
  },
  {
    id: 'chill',
    label: 'Chill & Emotional',
    tagline: 'Heartfelt drama & slice of life',
    icon: Heart,
    source: 'anilist',
    variables: {
      genre_in: ['Slice of Life', 'Drama', 'Romance'],
      averageScore_greater: 78,
      sort: ['SCORE_DESC'],
    },
  },
]

function cleanDescription(raw?: string | null): string {
  if (!raw) return 'No synopsis available for this title.'
  return raw.replace(/<[^>]*>/g, '').replace(/\n{2,}/g, ' ').trim()
}

export default function RoulettePage() {
  const watchlist = useWatchlist()
  const planningList = useMemo(
    () => watchlist.filter((e) => e.status === 'PLANNING'),
    [watchlist],
  )

  const [selectedMoodId, setSelectedMoodId] = useState<string>('dark-action')
  const [spinning, setSpinning] = useState(false)
  const [shuffleLabel, setShuffleLabel] = useState<string | null>(null)
  const [picked, setPicked] = useState<RouletteMedia | null>(null)
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [poolCache, setPoolCache] = useState<Record<string, RouletteMedia[]>>({})

  const activeMood = MOODS.find((m) => m.id === selectedMoodId) ?? MOODS[1]
  const existingEntry = picked ? watchlist.find((e) => e.id === picked.id) : undefined

  const handleSpin = async () => {
    if (spinning) return
    setSpinning(true)
    setError(null)

    try {
      let candidates: RouletteMedia[] = []

      if (activeMood.source === 'watchlist') {
        if (planningList.length === 0) {
          setError('Your "Plan to Watch" list is empty — add shows first or choose another mood!')
          setSpinning(false)
          return
        }
        candidates = planningList.map((e) => ({
          id: e.id,
          title: { romaji: e.title, english: e.title },
          coverImage: { large: e.coverImage, medium: e.coverImage, color: null },
          format: e.format,
          status: null,
          episodes: e.episodes,
          seasonYear: null,
          averageScore: e.averageScore,
          genres: e.genres,
          nextAiringEpisode: null,
          description: 'Currently waiting in your Plan to Watch backlog. Ready to start Episode 1?',
        }))
      } else {
        const randomPage = Math.floor(Math.random() * 4) + 1
        const cacheKey = `${activeMood.id}:p${randomPage}`
        if (poolCache[cacheKey]?.length) {
          candidates = poolCache[cacheKey]
        } else {
          const res = await anilist<{ Page: { media: RouletteMedia[] } }>(ROULETTE_QUERY, {
            page: randomPage,
            ...activeMood.variables,
          })
          candidates = res?.Page?.media ?? []
          if (candidates.length > 0) {
            setPoolCache((prev) => ({ ...prev, [cacheKey]: candidates }))
          }
        }
      }

      if (candidates.length === 0) {
        setError('No matching anime found for this spin. Try again!')
        setSpinning(false)
        return
      }

      // Filter out already seen cards in this session if possible
      const unseen = candidates.filter((c) => !seenIds.has(c.id))
      const pool = unseen.length > 0 ? unseen : candidates
      const winner = pool[Math.floor(Math.random() * pool.length)]

      // Tactile 6-step deck shuffle animation
      const shuffleSteps = 6
      for (let i = 0; i < shuffleSteps; i++) {
        const sample = candidates[Math.floor(Math.random() * candidates.length)]
        setShuffleLabel(displayTitle(sample.title))
        await new Promise((r) => setTimeout(r, 95 + i * 25))
      }

      setShuffleLabel(null)
      setPicked(winner)
      setSeenIds((prev) => new Set(prev).add(winner.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spin failed. Please try again.')
    } finally {
      setSpinning(false)
    }
  }

  const handleStartWatching = () => {
    if (!picked) return
    if (existingEntry) {
      updateEntry(picked.id, { status: 'WATCHING' })
    } else {
      addToWatchlist(picked, 'WATCHING')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Dices className="size-7 text-primary" />
            Anime Mood Roulette
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick your vibe, shuffle the deck, and let Anideck deal your next watch.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSpin}
          disabled={spinning}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
        >
          <RotateCw className={cn('size-4', spinning && 'animate-spin')} />
          {spinning ? 'Shuffling Deck...' : picked ? 'Spin Again' : 'Spin the Deck'}
        </button>
      </div>

      {/* Mood Selector Grid */}
      <section aria-label="Choose a mood" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {MOODS.map((m) => {
          const Icon = m.icon
          const isSelected = m.id === selectedMoodId
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMoodId(m.id)
                setError(null)
              }}
              className={cn(
                'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/15 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {m.id === 'watchlist' && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground tabular-nums">
                    {planningList.length}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold leading-snug text-foreground">{m.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{m.tagline}</p>
              </div>
            </button>
          )
        })}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Stage / Card Reveal Area */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {spinning ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="relative flex size-20 items-center justify-center rounded-2xl border-2 border-primary bg-primary/15 shadow-lg shadow-primary/20">
              <Dices className="size-10 animate-bounce text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Dealing from {activeMood.label}</p>
              <p className="line-clamp-1 max-w-md text-lg font-bold text-foreground">
                {shuffleLabel || 'Shuffling titles...'}
              </p>
            </div>
          </div>
        ) : picked ? (
          <div className="relative animate-in fade-in zoom-in-95 duration-300">
            {/* Ambient Blurred Backdrop */}
            {(picked.bannerImage || picked.coverImage.large) && (
              <img
                src={picked.bannerImage || picked.coverImage.large || ''}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full scale-105 object-cover opacity-20 blur-xl"
              />
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/60 sm:bg-gradient-to-r"
            />

            <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center md:p-8">
              {/* Poster */}
              <Link
                href={`/anime/${picked.id}`}
                className="group relative mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/50 bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-52"
              >
                <img
                  src={picked.coverImage.large || '/placeholder.svg'}
                  alt={displayTitle(picked.title)}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </Link>

              {/* Details */}
              <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                    <Sparkles className="size-3.5" /> Deal Winner
                  </span>
                  {picked.averageScore && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-upcoming">
                      <Star className="size-3 fill-upcoming text-upcoming" /> {picked.averageScore}%
                    </span>
                  )}
                  {picked.format && (
                    <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                      {formatEnum(picked.format)}
                    </span>
                  )}
                  {picked.episodes && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Tv className="size-3" /> {picked.episodes} eps
                    </span>
                  )}
                </div>

                <Link href={`/anime/${picked.id}`} className="group w-fit">
                  <h2 className="text-balance text-2xl font-bold tracking-tight transition-colors group-hover:text-primary md:text-3xl">
                    {displayTitle(picked.title)}
                  </h2>
                </Link>

                {picked.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {picked.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-md border border-border bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-foreground/90"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="line-clamp-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {cleanDescription(picked.description)}
                </p>

                {/* Action Buttons */}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartWatching}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all',
                      existingEntry?.status === 'WATCHING'
                        ? 'border border-airing/40 bg-airing/15 text-airing'
                        : 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
                    )}
                  >
                    {existingEntry?.status === 'WATCHING' ? (
                      <>
                        <Check className="size-4" /> Watching Now
                      </>
                    ) : (
                      <>
                        <Play className="size-4 fill-current" /> Start Watching
                      </>
                    )}
                  </button>

                  {!existingEntry && (
                    <button
                      type="button"
                      onClick={() => addToWatchlist(picked, 'PLANNING')}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary/80 px-4 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary"
                    >
                      <BookmarkPlus className="size-4" /> Save for Later
                    </button>
                  )}

                  <Link
                    href={`/anime/${picked.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Eye className="size-4" /> Full Details
                  </Link>

                  <button
                    type="button"
                    onClick={handleSpin}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <RotateCw className="size-4" /> Re-Roll
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <Dices className="size-8" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-lg font-bold">Ready to Deal</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Selected mood: <span className="font-semibold text-foreground">{activeMood.label}</span>. Tap{' '}
                <span className="font-semibold text-primary">Spin the Deck</span> above to draw a random recommendation.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSpin}
              className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90"
            >
              <Dices className="size-4" /> Spin Now
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
