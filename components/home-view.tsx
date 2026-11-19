'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowRight, ChevronLeft, ChevronRight, Dices, Flame, Play, Plus, Sparkles, Star, Tv } from 'lucide-react'
import { displayTitle, formatEnum, HOME_QUERY, SEARCH_QUERY, type MediaCard } from '@/lib/anilist'
import { incrementProgress, updateEntry, useWatchlist } from '@/lib/watchlist'
import { AnimeGrid, SectionHeading } from './anime-grid'
import { GenreBar } from './genre-bar'

type HomeData = Record<'trending' | 'airing' | 'upcoming', { media: MediaCard[] }>

const AUTO_SCROLL_MS = 4000

export function HomeView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const genre = params.get('genre')

  const watchlist = useWatchlist()
  const watchingList = watchlist
    .filter((e) => e.status === 'WATCHING')
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const upNextList = watchingList.length > 0
    ? watchingList
    : watchlist
        .filter((e) => e.status === 'PLANNING' || e.status === 'PAUSED')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10)

  const home = useSWR<HomeData>(genre ? null : [HOME_QUERY, {}])
  const byGenre = useSWR<{ Page: { media: MediaCard[] } }>(
    genre ? [SEARCH_QUERY, { genre, sort: ['SCORE_DESC'], page: 1 }] : null,
  )

  const featuredList = (home.data?.trending.media ?? []).slice(0, 6)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (featuredList.length <= 1 || genre) return
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredList.length)
    }, AUTO_SCROLL_MS)
    return () => window.clearInterval(timer)
  }, [featuredList.length, genre, activeIndex])

  const safeIndex = featuredList.length > 0 ? activeIndex % featuredList.length : 0
  const spotlight = featuredList[safeIndex]

  const selectGenre = (g: string | null) => {
    router.replace(g ? `${pathname}?genre=${encodeURIComponent(g)}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        {!genre && (
          home.isLoading && !spotlight ? (
            <div className="h-64 animate-pulse rounded-2xl border border-border bg-card md:h-72" />
          ) : spotlight ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              {/* Blurred Ambient Background */}
              {spotlight.coverImage.large && (
                <img
                  key={`bg-${spotlight.id}`}
                  src={spotlight.coverImage.large}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl transition-opacity duration-500"
                />
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40"
              />

              <div
                key={`slide-${spotlight.id}`}
                className="relative flex flex-col gap-5 p-5 animate-in fade-in duration-500 sm:flex-row sm:items-center md:gap-7 md:p-7"
              >
                {/* Poster Thumbnail */}
                <Link
                  href={`/anime/${spotlight.id}`}
                  className="group relative mx-auto aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-lg sm:mx-0 sm:w-36 md:w-44"
                >
                  <img
                    src={spotlight.coverImage.large || '/placeholder.svg'}
                    alt={displayTitle(spotlight.title)}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </Link>

                {/* Spotlight Details */}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                      <Flame className="size-3.5" aria-hidden="true" /> #{safeIndex + 1} Trending
                    </span>
                    {spotlight.averageScore && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold text-upcoming">
                        <Star className="size-3 fill-upcoming text-upcoming" aria-hidden="true" />
                        {spotlight.averageScore}%
                      </span>
                    )}
                    {spotlight.nextAiringEpisode && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-airing/30 bg-airing/15 px-2.5 py-0.5 text-xs font-medium text-airing">
                        <Tv className="size-3" aria-hidden="true" />
                        Ep {spotlight.nextAiringEpisode.episode} airing soon
                      </span>
                    )}
                  </div>

                  <Link href={`/anime/${spotlight.id}`} className="group w-fit">
                    <h1 className="line-clamp-2 text-balance text-2xl font-bold tracking-tight transition-colors group-hover:text-primary md:text-3xl">
                      {displayTitle(spotlight.title)}
                    </h1>
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {spotlight.format && <span>{formatEnum(spotlight.format)}</span>}
                    {spotlight.seasonYear && <span>• {spotlight.seasonYear}</span>}
                    {spotlight.episodes && <span>• {spotlight.episodes} episodes</span>}
                    {spotlight.status && <span>• {formatEnum(spotlight.status)}</span>}
                  </div>

                  {spotlight.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {spotlight.genres.slice(0, 4).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => selectGenre(g)}
                          className="rounded-md border border-border bg-secondary/70 px-2.5 py-0.5 text-xs font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions & Carousel Controls */}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/anime/${spotlight.id}`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                      >
                        <Play className="size-3.5 fill-current" aria-hidden="true" />
                        View Details
                      </Link>
                      <Link
                        href="/calendar"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                      >
                        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                        Schedule
                      </Link>
                      <Link
                        href="/roulette"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        <Dices className="size-3.5" aria-hidden="true" />
                        Mood Spin
                      </Link>
                    </div>

                    {featuredList.length > 1 && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {featuredList.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveIndex(idx)}
                              aria-label={`Show featured anime ${idx + 1}`}
                              className={`h-2 rounded-full transition-all ${
                                idx === safeIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="ml-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length)
                            }
                            aria-label="Previous featured anime"
                            className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary/80 text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveIndex((prev) => (prev + 1) % featuredList.length)}
                            aria-label="Next featured anime"
                            className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary/80 text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Auto-Scroll Indicator Bar */}
              {featuredList.length > 1 && (
                <div className="relative h-1 w-full bg-secondary/60">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((safeIndex + 1) / featuredList.length) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ) : null
        )}

        <GenreBar selected={genre} onSelect={selectGenre} />
      </section>

      {/* Continue Watching Section */}
      {!genre && (
        <section>
          <SectionHeading
            title={
              watchingList.length > 0
                ? `Continue watching (${watchingList.length})`
                : upNextList.length > 0
                  ? 'Up next from your watchlist'
                  : 'Continue watching'
            }
          >
            <Link href="/watchlist" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              Full watchlist <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </SectionHeading>

          {upNextList.length > 0 ? (
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div className="flex gap-3 pb-2">
                {upNextList.map((entry) => {
                  const pct = entry.episodes ? Math.min(100, Math.round((entry.progress / entry.episodes) * 100)) : null
                  const canIncrement = !entry.episodes || entry.progress < entry.episodes
                  const isWatching = entry.status === 'WATCHING'

                  return (
                    <div
                      key={entry.id}
                      className="flex w-64 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40 sm:w-72"
                    >
                      <Link
                        href={`/anime/${entry.id}`}
                        className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted"
                      >
                        <img
                          src={entry.coverImage || '/placeholder.svg'}
                          alt={entry.title}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Link
                          href={`/anime/${entry.id}`}
                          className="line-clamp-2 text-xs font-semibold leading-snug hover:text-primary"
                        >
                          {entry.title}
                        </Link>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            Ep {entry.progress}
                            {entry.episodes ? ` / ${entry.episodes}` : ''}
                          </span>
                          {isWatching ? (
                            canIncrement && (
                              <button
                                type="button"
                                onClick={() => incrementProgress(entry.id)}
                                aria-label={`Increment episode for ${entry.title}`}
                                className="inline-flex h-6 items-center gap-0.5 rounded-md bg-primary/15 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                              >
                                <Plus className="size-3" aria-hidden="true" />1 Ep
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateEntry(entry.id, { status: 'WATCHING' })}
                              className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/15 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              <Play className="size-2.5 fill-current" aria-hidden="true" /> Watch
                            </button>
                          )}
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${pct ?? (entry.progress > 0 ? 45 : 8)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
              <span>No shows marked as Watching yet.</span>
              <Link href="/watchlist" className="font-semibold text-primary hover:underline">
                Open Watchlist
              </Link>
            </div>
          )}
        </section>
      )}

      {genre ? (
        <section aria-live="polite">
          <SectionHeading title={`Top ${genre} anime`}>
            <Link
              href={`/search?genre=${encodeURIComponent(genre)}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              Refine in Search <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </SectionHeading>
          <AnimeGrid
            items={byGenre.data?.Page.media}
            loading={byGenre.isLoading}
            error={byGenre.error}
            skeletonCount={18}
          />
        </section>
      ) : (
        <>
          <section>
            <SectionHeading title="Trending now" />
            <AnimeGrid items={home.data?.trending.media} loading={home.isLoading} error={home.error} />
          </section>
          <section>
            <SectionHeading title="Currently airing">
              <Link href="/calendar" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                Weekly calendar <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </SectionHeading>
            <AnimeGrid items={home.data?.airing.media} loading={home.isLoading} error={home.error} />
          </section>
          <section>
            <SectionHeading title="Upcoming" />
            <AnimeGrid items={home.data?.upcoming.media} loading={home.isLoading} error={home.error} />
          </section>
        </>
      )}
    </div>
  )
}
