'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
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

const AUTO_SCROLL_MS = 4000

const STUDIO_TOOLS = [
  {
    href: '/roulette',
    title: 'Mood Roulette',
    subtitle: 'Shuffle & deal a random pick',
    icon: Dices,
  },
  {
    href: '/dna',
    title: 'DNA Finder',
    subtitle: 'Shared seiyuu & studios',
    icon: Dna,
  },
  {
    href: '/tierlist',
    title: 'Tier List',
    subtitle: 'Rank & export PNG cards',
    icon: Trophy,
  },
  {
    href: '/radar',
    title: 'Sequel Radar',
    subtitle: 'Missing sequels & blind spots',
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

  const featuredList = (home.data?.trending.media ?? []).slice(0, 5)
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
            <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-card md:h-80" />
          ) : spotlight ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
              {/* Main Cinema Hero Card */}
              <div className="glass-panel relative overflow-hidden rounded-3xl shadow-2xl">
                {spotlight.coverImage.large && (
                  <img
                    key={`bg-${spotlight.id}`}
                    src={spotlight.coverImage.large}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl transition-opacity duration-500"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/70 to-transparent sm:bg-gradient-to-r sm:from-[#09090B]/95 sm:via-[#09090B]/75 sm:to-transparent"
                />

                <div
                  key={`slide-${spotlight.id}`}
                  className="relative flex h-full flex-col justify-between gap-5 p-5 animate-in fade-in duration-500 sm:flex-row sm:items-center md:p-7"
                >
                  {/* Poster */}
                  <Link
                    href={`/anime/${spotlight.id}`}
                    className="group relative mx-auto aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-muted shadow-2xl sm:mx-0 sm:w-40 md:w-44"
                  >
                    <img
                      src={spotlight.coverImage.large || '/placeholder.svg'}
                      alt={displayTitle(spotlight.title)}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {spotlight.averageScore && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-bold text-upcoming backdrop-blur-md">
                        <Star className="size-3 fill-upcoming text-upcoming" /> {spotlight.averageScore}%
                      </span>
                    )}
                  </Link>

                  {/* Metadata & Actions */}
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground active-pill">
                        <Flame className="size-3.5" aria-hidden="true" /> #{safeIndex + 1} Spotlight
                      </span>
                      {spotlight.nextAiringEpisode && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-airing/30 bg-airing/15 px-2.5 py-0.5 text-xs font-medium text-airing">
                          <Tv className="size-3" aria-hidden="true" />
                          Ep {spotlight.nextAiringEpisode.episode} soon
                        </span>
                      )}
                    </div>

                    <Link href={`/anime/${spotlight.id}`} className="group w-fit">
                      <h1 className="line-clamp-2 text-balance text-2xl font-extrabold tracking-tight text-white transition-colors group-hover:text-primary md:text-3xl">
                        {displayTitle(spotlight.title)}
                      </h1>
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                      {spotlight.format && <span>{formatEnum(spotlight.format)}</span>}
                      {spotlight.seasonYear && <span>• {spotlight.seasonYear}</span>}
                      {spotlight.episodes && <span>• {spotlight.episodes} eps</span>}
                      {spotlight.status && <span>• {formatEnum(spotlight.status)}</span>}
                    </div>

                    {spotlight.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {spotlight.genres.slice(0, 4).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => selectGenre(g)}
                            className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:text-primary"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/anime/${spotlight.id}`}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground active-pill transition-opacity hover:opacity-90"
                      >
                        <Play className="size-3.5 fill-current" aria-hidden="true" />
                        Watch & Details
                      </Link>
                      <Link
                        href="/roulette"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-xs font-semibold text-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        <Dices className="size-3.5 text-primary" aria-hidden="true" />
                        Mood Spin
                      </Link>
                      <Link
                        href="/calendar"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-xs font-semibold text-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                        Schedule
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Progress Indicator Dots */}
                {featuredList.length > 1 && (
                  <div className="relative flex items-center justify-center gap-1.5 pb-3.5">
                    {featuredList.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        aria-label={`Show featured anime ${idx + 1}`}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          idx === safeIndex ? 'w-7 bg-primary active-pill' : 'w-1.5 bg-white/25 hover:bg-white/50',
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right-Hand Translucent Quick-Select Dock */}
              <div className="glass-panel hidden lg:flex flex-col justify-between gap-2 rounded-3xl p-3">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Top Trending
                  </span>
                  <span className="text-[11px] font-mono text-primary">
                    0{safeIndex + 1} / 0{featuredList.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {featuredList.map((item, idx) => {
                    const active = idx === safeIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-2xl p-2 text-left transition-all',
                          active
                            ? 'border border-primary/40 bg-primary/15 shadow-sm'
                            : 'border border-transparent hover:bg-white/[0.04]',
                        )}
                      >
                        <img
                          src={item.coverImage.medium || item.coverImage.large || '/placeholder.svg'}
                          alt=""
                          className="size-10 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-xs font-semibold',
                              active ? 'text-white' : 'text-foreground/85',
                            )}
                          >
                            {displayTitle(item.title)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.averageScore ? `★ ${item.averageScore}%` : formatEnum(item.format)}
                            {item.episodes ? ` · ${item.episodes} eps` : ''}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null
        )}

        <GenreBar selected={genre} onSelect={selectGenre} />

        {/* Anideck Studio Quick-Access Launcher Bar */}
        {!genre && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {STUDIO_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="glass-card group flex items-center gap-3 rounded-2xl p-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white group-hover:text-primary">
                      {tool.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{tool.subtitle}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Glassmorphic Continue Watching Shelf */}
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
            <Link href="/watchlist" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </SectionHeading>

          {upNextList.length > 0 ? (
            <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div className="flex gap-3.5 pb-2">
                {upNextList.map((entry) => {
                  const pct = entry.episodes ? Math.min(100, Math.round((entry.progress / entry.episodes) * 100)) : null
                  const canIncrement = !entry.episodes || entry.progress < entry.episodes
                  const isWatching = entry.status === 'WATCHING'

                  return (
                    <div
                      key={entry.id}
                      className="glass-card flex w-68 shrink-0 items-center gap-3 rounded-2xl p-2.5 sm:w-72"
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
                          className="line-clamp-2 text-xs font-semibold leading-snug text-white hover:text-primary"
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
          ) : (
            <div className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3 text-xs text-muted-foreground">
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
