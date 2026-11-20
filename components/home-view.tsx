'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  Dna,
  Flame,
  Play,
  Plus,
  Radar,
  Sparkles,
  Star,
  Trophy,
  Tv,
} from 'lucide-react'
import { displayTitle, formatEnum, HOME_QUERY, SEARCH_QUERY, type MediaCard } from '@/lib/anilist'
import { incrementProgress, updateEntry, useWatchlist } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { AnimeGrid, SectionHeading } from './anime-grid'
import { GenreBar } from './genre-bar'

type HomeData = Record<'trending' | 'airing' | 'upcoming', { media: MediaCard[] }>

const AUTO_SCROLL_MS = 5000

const STUDIO_TOOLS = [
  {
    href: '/roulette',
    title: 'Mood Spin',
    icon: Dices,
  },
  {
    href: '/dna',
    title: 'DNA Finder',
    icon: Dna,
  },
  {
    href: '/tierlist',
    title: 'Tier List',
    icon: Trophy,
  },
  {
    href: '/radar',
    title: 'Sequel Radar',
    icon: Radar,
  },
] as const

export function HomeView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const genre = params.get('genre')

  const watchlist = useWatchlist()
  const watchingList = watchlist
    .filter((e) => e.status === 'WATCHING')
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const upNextList =
    watchingList.length > 0
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
  const inWatchlist = spotlight ? watchlist.some((w) => w.id === spotlight.id) : false

  const selectGenre = (g: string | null) => {
    router.replace(g ? `${pathname}?genre=${encodeURIComponent(g)}` : pathname, { scroll: false })
  }

  const handleHeroWatchlistToggle = () => {
    if (!spotlight) return
    if (inWatchlist) {
      router.push('/watchlist')
      return
    }
    updateEntry(spotlight.id, {
      id: spotlight.id,
      title: displayTitle(spotlight.title),
      coverImage: spotlight.coverImage.large || spotlight.coverImage.medium || '',
      episodes: spotlight.episodes ?? null,
      status: 'PLANNING',
      progress: 0,
      score: 0,
      updatedAt: Date.now(),
    })
  }

  const airingList = home.data?.airing.media ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Editorial Hero Banner + 2x3 Bento Stats Grid */}
      <section className="flex flex-col gap-4">
        {!genre && (
          home.isLoading && !spotlight ? (
            <div className="h-80 animate-pulse rounded-3xl border border-white/10 bg-card md:h-96" />
          ) : spotlight ? (
            <div className="glass-panel relative overflow-hidden rounded-3xl">
              {/* Oversized Widescreen Backdrop Artwork */}
              {(spotlight.bannerImage || spotlight.coverImage.large) && (
                <img
                  key={`hero-bg-${spotlight.id}`}
                  src={spotlight.bannerImage || spotlight.coverImage.large || ''}
                  alt=""
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 size-full object-cover transition-all duration-700',
                    spotlight.bannerImage ? 'opacity-55' : 'scale-110 opacity-35 blur-2xl',
                  )}
                />
              )}

              {/* Editorial Vignette Overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1015] via-[#0E1015]/65 to-[#0E1015]/25 lg:bg-gradient-to-r lg:from-[#0E1015]/95 lg:via-[#0E1015]/65 lg:to-[#0E1015]/40"
              />

              <div
                key={`hero-content-${spotlight.id}`}
                className="relative grid gap-6 p-6 animate-in fade-in duration-500 md:p-8 lg:grid-cols-[1fr_320px] lg:items-end"
              >
                {/* Left Editorial Title & Action Pills */}
                <div className="flex min-w-0 flex-col gap-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold active-pill">
                      <Flame className="size-3.5" aria-hidden="true" /> #{safeIndex + 1} Editorial Pick
                    </span>
                    {spotlight.nextAiringEpisode && (
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold amber-pill">
                        <Tv className="size-3.5" aria-hidden="true" />
                        Ep {spotlight.nextAiringEpisode.episode} Airing
                      </span>
                    )}
                    {spotlight.genres.slice(0, 2).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => selectGenre(g)}
                        className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition-colors hover:border-primary hover:text-primary"
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  <Link href={`/anime/${spotlight.id}`} className="group w-fit">
                    <h1 className="line-clamp-2 text-balance text-3xl font-black tracking-tight text-white drop-shadow-sm transition-colors group-hover:text-primary sm:text-4xl md:text-5xl">
                      {displayTitle(spotlight.title)}
                    </h1>
                  </Link>

                  <p className="max-w-xl text-xs font-medium text-slate-300/90 sm:text-sm">
                    {[
                      formatEnum(spotlight.format),
                      spotlight.seasonYear,
                      spotlight.episodes ? `${spotlight.episodes} Episodes` : null,
                      spotlight.status ? formatEnum(spotlight.status) : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>

                  {/* Sunset Coral & Warm Amber Pill Buttons */}
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/anime/${spotlight.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-extrabold active-pill transition-transform hover:scale-[1.02]"
                    >
                      <Play className="size-3.5 fill-current" aria-hidden="true" />
                      Explore &amp; Themes
                    </Link>

                    <button
                      type="button"
                      onClick={handleHeroWatchlistToggle}
                      className={cn(
                        'inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-xs font-extrabold transition-transform hover:scale-[1.02]',
                        inWatchlist
                          ? 'border border-white/20 bg-white/15 text-white backdrop-blur-md'
                          : 'amber-pill',
                      )}
                    >
                      {inWatchlist ? (
                        <>
                          <Check className="size-3.5" aria-hidden="true" /> In Watchlist
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" aria-hidden="true" /> Watchlist
                        </>
                      )}
                    </button>

                    {/* Carousel Prev / Next Controls */}
                    {featuredList.length > 1 && (
                      <div className="ml-auto flex items-center gap-1.5 sm:ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length)
                          }
                          aria-label="Previous featured anime"
                          className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors hover:border-primary hover:text-primary"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveIndex((prev) => (prev + 1) % featuredList.length)}
                          aria-label="Next featured anime"
                          className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors hover:border-primary hover:text-primary"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 2x3 Bento Stats Grid (Matching Editorial Gallery Mockup) */}
                <div className="bento-stat grid grid-cols-2 overflow-hidden rounded-2xl">
                  <div className="border-b border-r border-white/10 p-3.5">
                    <p className="text-base font-extrabold text-white">
                      {spotlight.averageScore ? `${spotlight.averageScore}%` : '—'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Community Score</p>
                  </div>
                  <div className="border-b border-white/10 p-3.5">
                    <p className="text-base font-extrabold text-white">
                      {spotlight.episodes ? `${spotlight.episodes} Eps` : 'Ongoing'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Total Episodes</p>
                  </div>
                  <div className="border-b border-r border-white/10 p-3.5">
                    <p className="text-base font-extrabold text-upcoming">
                      {spotlight.popularity ? spotlight.popularity.toLocaleString() : 'Top'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Active Fans</p>
                  </div>
                  <div className="border-b border-white/10 p-3.5">
                    <p className="text-base font-extrabold text-white">
                      {formatEnum(spotlight.format) || 'TV'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Release Format</p>
                  </div>
                  <div className="border-r border-white/10 p-3.5">
                    <p className="truncate text-sm font-extrabold text-primary">
                      {spotlight.studios?.nodes?.[0]?.name || spotlight.seasonYear || 'Featured'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Animation Studio</p>
                  </div>
                  <div className="p-3.5">
                    <p className="text-sm font-extrabold text-white">
                      #{safeIndex + 1} Trending
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">Global Chart</p>
                  </div>
                </div>
              </div>

              {/* Bottom Slide Progress Bars */}
              {featuredList.length > 1 && (
                <div className="relative flex items-center justify-center gap-2 pb-4">
                  {featuredList.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      aria-label={`Show slide ${idx + 1}`}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        idx === safeIndex ? 'w-8 active-pill' : 'w-2 bg-white/25 hover:bg-white/50',
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null
        )}

        {/* Rounded Pill Filters & Studio Quick-Launch Pills */}
        <div className="flex flex-col gap-3">
          <GenreBar selected={genre} onSelect={selectGenre} />

          {!genre && (
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {STUDIO_TOOLS.map((tool) => {
                const Icon = tool.icon
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="glass-card inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-slate-200 hover:text-primary"
                  >
                    <Icon className="size-3.5 text-primary" aria-hidden="true" />
                    <span>{tool.title}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Continue Watching Shelf */}
      {!genre && upNextList.length > 0 && (
        <section>
          <SectionHeading
            title={
              watchingList.length > 0
                ? `Continue watching (${watchingList.length})`
                : 'Up next from your watchlist'
            }
          >
            <Link href="/watchlist" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </SectionHeading>

          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex gap-3.5 pb-2">
              {upNextList.map((entry) => {
                const pct = entry.episodes ? Math.min(100, Math.round((entry.progress / entry.episodes) * 100)) : null
                const canIncrement = !entry.episodes || entry.progress < entry.episodes
                const isWatching = entry.status === 'WATCHING'

                return (
                  <div
                    key={entry.id}
                    className="glass-card flex w-72 shrink-0 items-center gap-3 rounded-2xl p-2.5"
                  >
                    <Link
                      href={`/anime/${entry.id}`}
                      className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-muted"
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
                        className="line-clamp-2 text-xs font-bold leading-snug text-white hover:text-primary"
                      >
                        {entry.title}
                      </Link>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          Ep {entry.progress}
                          {entry.episodes ? ` / ${entry.episodes}` : ''}
                        </span>
                        {isWatching ? (
                          canIncrement && (
                            <button
                              type="button"
                              onClick={() => incrementProgress(entry.id)}
                              aria-label={`Increment episode for ${entry.title}`}
                              className="inline-flex h-6 items-center gap-0.5 rounded-full bg-primary/20 px-2.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                            >
                              <Plus className="size-3" aria-hidden="true" />1 Ep
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateEntry(entry.id, { status: 'WATCHING' })}
                            className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/20 px-2.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                          >
                            <Play className="size-2.5 fill-current" aria-hidden="true" /> Watch
                          </button>
                        )}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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
        </section>
      )}

      {genre ? (
        <section aria-live="polite">
          <SectionHeading title={`Top ${genre} anime`}>
            <Link
              href={`/search?genre=${encodeURIComponent(genre)}`}
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary"
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
          {/* Horizontal "CURRENTLY AIRING" Landscape Spotlight Row (Matching Editorial Gallery Mockup) */}
          <section>
            <SectionHeading title="Currently airing">
              <Link href="/calendar" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                Weekly schedule <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </SectionHeading>

            {home.isLoading && airingList.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
                ))}
              </div>
            ) : (
              <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="flex gap-4 pb-2">
                  {airingList.slice(0, 10).map((anime) => {
                    const cardBg = anime.bannerImage || anime.coverImage.large
                    const studioName = anime.studios?.nodes?.[0]?.name
                    return (
                      <Link
                        key={anime.id}
                        href={`/anime/${anime.id}`}
                        className="glass-card group relative flex h-44 w-80 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border-primary/25 p-4 sm:w-96"
                      >
                        {cardBg && (
                          <img
                            src={cardBg}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 size-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1015] via-[#0E1015]/55 to-[#0E1015]/20"
                        />

                        {/* Top Coral "Now" & Amber "Episode" Pills */}
                        <div className="relative flex items-center justify-between gap-2">
                          <span className="rounded-full px-3 py-0.5 text-[11px] font-extrabold active-pill">
                            Now
                          </span>
                          {anime.nextAiringEpisode ? (
                            <span className="rounded-full px-3 py-0.5 text-[11px] font-extrabold amber-pill">
                              Episode {anime.nextAiringEpisode.episode}
                            </span>
                          ) : anime.episodes ? (
                            <span className="rounded-full px-3 py-0.5 text-[11px] font-extrabold amber-pill">
                              {anime.episodes} Eps
                            </span>
                          ) : null}
                        </div>

                        {/* Bottom Title & Metadata Pills */}
                        <div className="relative flex flex-col gap-2">
                          <h3 className="line-clamp-1 text-base font-extrabold text-white transition-colors group-hover:text-primary">
                            {displayTitle(anime.title)}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {anime.averageScore && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[11px] font-bold text-upcoming backdrop-blur-md">
                                <Star className="size-3 fill-upcoming text-upcoming" />
                                {anime.averageScore}% Score
                              </span>
                            )}
                            {studioName && (
                              <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-md">
                                {studioName}
                              </span>
                            )}
                            {anime.format && (
                              <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 backdrop-blur-md">
                                {formatEnum(anime.format)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Popular This Season / Trending Now Editorial Grid */}
          <section>
            <SectionHeading title="Popular this season">
              <Sparkles className="size-4 text-upcoming" aria-hidden="true" />
            </SectionHeading>
            <AnimeGrid items={home.data?.trending.media} loading={home.isLoading} error={home.error} />
          </section>

          {/* Upcoming Releases */}
          <section>
            <SectionHeading title="Upcoming releases" />
            <AnimeGrid items={home.data?.upcoming.media} loading={home.isLoading} error={home.error} />
          </section>
        </>
      )}
    </div>
  )
}
