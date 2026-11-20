'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Dna,
  ExternalLink,
  Film,
  Flame,
  Music,
  Play,
  PlayCircle,
  Sparkles,
  Star,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import { displayTitle, formatEnum, formatFuzzyDate, MEDIA_DETAIL_QUERY, type MediaDetail } from '@/lib/anilist'
import { cn } from '@/lib/utils'
import { AiringCountdown, StatusBadge } from './status-badge'
import { RichDescription } from './rich-description'
import { CharacterCard, StaffCard } from './person-card'
import { WatchlistControls } from './watchlist-controls'
import { Recommendations } from './recommendations'

type DetailTab = 'overview' | 'themes' | 'cast' | 'staff'

type AnimeThemeItem = {
  id: string
  type: 'OP' | 'ED'
  slug: string
  songTitle: string
  artists: string[]
  episodes: string | null
  videoUrl: string | null
}

function parseJikanLine(raw: string, type: 'OP' | 'ED', idx: number): AnimeThemeItem {
  const cleaned = raw.replace(/^\d+:\s*/, '').trim()
  const epMatch = cleaned.match(/\(([^)]+)\)\s*$/)
  const episodes = epMatch ? epMatch[1].replace(/^eps?\s*/i, '') : null
  const withoutEp = epMatch ? cleaned.slice(0, epMatch.index).trim() : cleaned

  const titleMatch = withoutEp.match(/^"([^"]+)"\s*(?:by\s*(.+))?$/i)
  if (titleMatch) {
    return {
      id: `jikan-${type}-${idx}`,
      type,
      slug: `${type}${idx + 1}`,
      songTitle: titleMatch[1].trim(),
      artists: titleMatch[2] ? [titleMatch[2].trim()] : [],
      episodes,
      videoUrl: null,
    }
  }

  return {
    id: `jikan-${type}-${idx}`,
    type,
    slug: `${type}${idx + 1}`,
    songTitle: withoutEp || `${type} ${idx + 1}`,
    artists: [],
    episodes,
    videoUrl: null,
  }
}

async function fetchTimed(url: string, init?: RequestInit, ms = 6000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

async function loadThemesForAnime(key: [string, number, string]): Promise<AnimeThemeItem[]> {
  const [, anilistId, searchTitle] = key

  // 1. Try server route /api/themes first (gives AnimeThemes video previews)
  try {
    const params = new URLSearchParams({ id: String(anilistId) })
    if (searchTitle) params.set('title', searchTitle)
    const res = await fetchTimed(`/api/themes?${params.toString()}`, undefined, 4500)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json?.themes) && json.themes.length > 0) {
        return json.themes
      }
    }
  } catch {
    // Fall through to direct browser fetch
  }

  // 2. Direct browser fetch: get idMal directly from AniList GraphQL
  let malId: number | null = null
  try {
    const gqlRes = await fetchTimed(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: 'query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }',
          variables: { id: anilistId },
        }),
      },
      5000,
    )
    if (gqlRes.ok) {
      const gqlJson = await gqlRes.json()
      malId = gqlJson?.data?.Media?.idMal ?? null
    }
  } catch {
    // Fall through to Jikan title search
  }

  // 3. Fallback title search on Jikan if idMal wasn't returned
  if (!malId && searchTitle) {
    try {
      const searchRes = await fetchTimed(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=1`,
        undefined,
        5000,
      )
      if (searchRes.ok) {
        const searchJson = await searchRes.json()
        malId = searchJson?.data?.[0]?.mal_id ?? null
      }
    } catch {
      // Ignore
    }
  }

  // 4. Fetch themes directly from Jikan in the browser
  if (malId) {
    try {
      const jikanRes = await fetchTimed(`https://api.jikan.moe/v4/anime/${malId}/themes`, undefined, 6000)
      if (jikanRes.ok) {
        const jikanJson = await jikanRes.json()
        const ops: string[] = Array.isArray(jikanJson?.data?.openings) ? jikanJson.data.openings : []
        const eds: string[] = Array.isArray(jikanJson?.data?.endings) ? jikanJson.data.endings : []
        return [
          ...ops.map((raw, idx) => parseJikanLine(raw, 'OP', idx)),
          ...eds.map((raw, idx) => parseJikanLine(raw, 'ED', idx)),
        ]
      }
    } catch {
      // Ignore
    }
  }

  return []
}

export function AnimeDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Media: MediaDetail }>([MEDIA_DETAIL_QUERY, { id }])
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [playingTheme, setPlayingTheme] = useState<AnimeThemeItem | null>(null)

  const media = data?.Media
  const resolvedTitle = media ? displayTitle(media.title) : ''

  const { data: themes = [], isLoading: themesLoading } = useSWR<AnimeThemeItem[]>(
    media ? ['anime-themes-v2', id, resolvedTitle] : null,
    (key: [string, number, string]) => loadThemesForAnime(key),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  if (error && !media) {
    return (
      <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }
  if (isLoading || !media) return <DetailSkeleton />

  const title = displayTitle(media.title)
  const streaming = media.externalLinks.filter((l) => l.type === 'STREAMING')
  const studios = [...media.studios.edges].sort((a, b) => Number(b.isMain) - Number(a.isMain))
  const mainStudios = studios.filter((s) => s.isMain)
  const heroBackdrop = media.bannerImage || media.coverImage.large

  const openings = themes.filter((t) => t.type === 'OP')
  const endings = themes.filter((t) => t.type === 'ED')

  const statPills = [
    { icon: Film, label: formatEnum(media.format) },
    { icon: Sparkles, label: media.episodes ? `${media.episodes} Episodes` : null },
    { icon: Clock, label: media.duration ? `${media.duration} min/ep` : null },
    {
      icon: Calendar,
      label: [formatEnum(media.season), media.seasonYear].filter(Boolean).join(' ') || formatFuzzyDate(media.startDate),
    },
    { icon: Flame, label: media.popularity ? `${media.popularity.toLocaleString()} fans` : null },
  ].filter((item) => Boolean(item.label))

  return (
    <article className="flex flex-col gap-6">
      {/* Full-Bleed Widescreen Cinema Banner */}
      <div className="relative -mx-4 -mt-5 overflow-hidden border-b border-white/10 md:-mx-6">
        <div className="relative h-56 w-full sm:h-72 md:h-80">
          {heroBackdrop ? (
            <img
              src={heroBackdrop}
              alt=""
              aria-hidden="true"
              className={cn(
                'size-full object-cover',
                !media.bannerImage && 'scale-110 opacity-45 blur-2xl',
              )}
            />
          ) : (
            <div className="size-full bg-card" />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-[#09090B]/30"
          />

          {/* Top Floating Nav Controls */}
          <div className="absolute inset-x-0 top-4 z-20 mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-xl transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
            </Link>

            <Link
              href="/dna"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/60 px-3.5 py-1.5 text-xs font-bold text-primary backdrop-blur-xl transition-colors hover:bg-primary hover:text-white"
            >
              <Dna className="size-3.5" aria-hidden="true" /> DNA Match
            </Link>
          </div>
        </div>

        {/* Overlapping Poster + Title Stage */}
        <div className="relative z-10 mx-auto -mt-28 max-w-7xl px-4 pb-6 sm:-mt-32 md:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {/* Elevated Poster Card */}
            {media.coverImage.large && (
              <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-44 md:w-52">
                <div className="overflow-hidden rounded-2xl border-2 border-white/15 bg-muted shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
                  <img
                    src={media.coverImage.large}
                    alt={`${title} cover art`}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Title, Studios & Stat Pills */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <StatusBadge status={media.status} />
                {media.averageScore != null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-upcoming/30 bg-upcoming/15 px-2.5 py-0.5 text-xs font-bold text-upcoming">
                    <Star className="size-3.5 fill-upcoming text-upcoming" aria-hidden="true" />
                    {media.averageScore}% Score
                  </span>
                )}
                {media.status === 'RELEASING' && media.nextAiringEpisode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-airing/30 bg-airing/15 px-3 py-0.5 text-xs font-semibold text-airing">
                    <AiringCountdown next={media.nextAiringEpisode} />
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-balance text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
                  {title}
                </h1>
                {media.title.native && (
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{media.title.native}</p>
                )}
              </div>

              {/* Quick Stat Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {mainStudios.map(({ node }) => (
                  <Link
                    key={node.id}
                    href={`/studio/${node.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <Building2 className="size-3" aria-hidden="true" />
                    {node.name}
                  </Link>
                ))}
                {statPills.map((pill, idx) => {
                  const Icon = pill.icon
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-foreground/85"
                    >
                      <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
                      {pill.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Glass Action & Streaming Dock */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-3xl p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <WatchlistControls media={media} />
        </div>

        {streaming.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Stream:
            </span>
            {streaming.slice(0, 4).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-primary/50 hover:bg-primary/15 hover:text-primary"
              >
                {link.icon ? (
                  <img src={link.icon} alt="" className="size-3.5 rounded-xs" />
                ) : (
                  <PlayCircle className="size-3.5 text-primary" aria-hidden="true" />
                )}
                <span>{link.site}</span>
                <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Stage Switcher Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-[#121215]/80 p-1">
          {(
            [
              { id: 'overview', label: 'Overview', icon: Sparkles },
              {
                id: 'themes',
                label: themes.length > 0 ? `OP / ED (${themes.length})` : 'OP / ED',
                icon: Music,
              },
              { id: 'cast', label: `Cast (${media.characters.edges.length})`, icon: Users },
              { id: 'staff', label: `Staff (${media.staff.edges.length})`, icon: Building2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setPlayingTheme(null)
                }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all',
                  active
                    ? 'bg-primary text-primary-foreground active-pill'
                    : 'text-muted-foreground hover:bg-white/[0.05] hover:text-white',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Genre Chips */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5">
          {media.genres.slice(0, 4).map((g) => (
            <Link
              key={g}
              href={`/search?genre=${encodeURIComponent(g)}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {g}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
          <section className="glass-panel rounded-3xl p-5 md:p-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">Story &amp; Synopsis</h2>
              {media.source && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Adapted from {formatEnum(media.source)}
                </span>
              )}
            </div>
            <RichDescription text={media.description} className="text-sm leading-relaxed text-foreground/90" />

            {/* Mobile Genre Chips */}
            {media.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-4 md:hidden">
                {media.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/search?genre=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-foreground/85"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <Recommendations items={media.recommendations.nodes} />
        </div>
      )}

      {activeTab === 'themes' && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Inline Cinema Theme Player */}
          {playingTheme && playingTheme.videoUrl && (
            <div className="glass-panel overflow-hidden rounded-3xl border-primary/40 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold text-white active-pill">
                    {playingTheme.slug}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{playingTheme.songTitle}</p>
                    {playingTheme.artists.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        by {playingTheme.artists.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlayingTheme(null)}
                  aria-label="Close theme player"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
              <video
                key={playingTheme.videoUrl}
                src={playingTheme.videoUrl}
                controls
                autoPlay
                playsInline
                className="aspect-video max-h-96 w-full rounded-2xl bg-black object-contain"
              />
            </div>
          )}

          {themesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
              <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
            </div>
          ) : themes.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted-foreground">
              No opening or ending theme songs indexed yet for this title.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Openings Column */}
              <div className="glass-panel flex flex-col gap-3 rounded-3xl p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <Volume2 className="size-4" /> Openings ({openings.length})
                </h3>
                {openings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No opening themes listed.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {openings.map((op) => {
                      const isPlaying = playingTheme?.id === op.id
                      return (
                        <div
                          key={op.id}
                          className={cn(
                            'glass-card flex items-center justify-between gap-3 rounded-2xl p-3',
                            isPlaying && 'border-primary bg-primary/15',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                                {op.slug}
                              </span>
                              {op.episodes && (
                                <span className="text-[11px] text-muted-foreground">Eps {op.episodes}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-white">{op.songTitle}</p>
                            {op.artists.length > 0 && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {op.artists.join(', ')}
                              </p>
                            )}
                          </div>
                          {op.videoUrl && (
                            <button
                              type="button"
                              onClick={() => setPlayingTheme(isPlaying ? null : op)}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-[11px] font-bold text-white active-pill transition-opacity hover:opacity-90"
                            >
                              <Play className="size-3 fill-current" />
                              {isPlaying ? 'Playing' : 'Preview'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Endings Column */}
              <div className="glass-panel flex flex-col gap-3 rounded-3xl p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <Music className="size-4" /> Endings ({endings.length})
                </h3>
                {endings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No ending themes listed.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {endings.map((ed) => {
                      const isPlaying = playingTheme?.id === ed.id
                      return (
                        <div
                          key={ed.id}
                          className={cn(
                            'glass-card flex items-center justify-between gap-3 rounded-2xl p-3',
                            isPlaying && 'border-primary bg-primary/15',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                                {ed.slug}
                              </span>
                              {ed.episodes && (
                                <span className="text-[11px] text-muted-foreground">Eps {ed.episodes}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-white">{ed.songTitle}</p>
                            {ed.artists.length > 0 && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {ed.artists.join(', ')}
                              </p>
                            )}
                          </div>
                          {ed.videoUrl && (
                            <button
                              type="button"
                              onClick={() => setPlayingTheme(isPlaying ? null : ed)}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-[11px] font-bold text-white active-pill transition-opacity hover:opacity-90"
                            >
                              <Play className="size-3 fill-current" />
                              {isPlaying ? 'Playing' : 'Preview'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'cast' && (
        <section className="animate-in fade-in duration-300">
          {media.characters.edges.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted-foreground">
              No characters listed yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {media.characters.edges.map((edge) => (
                <CharacterCard
                  key={edge.node.id}
                  character={edge.node}
                  role={edge.role}
                  voiceActor={edge.voiceActors[0]}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'staff' && (
        <section className="animate-in fade-in duration-300">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studios.map(({ node: studio, isMain }) => (
              <Link
                key={`studio-${studio.id}`}
                href={`/studio/${studio.id}`}
                className="glass-card group flex gap-3 rounded-2xl p-3"
              >
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Building2 className="size-5 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col justify-center">
                  <p className="truncate text-sm font-bold text-white group-hover:text-primary">{studio.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMain ? 'Main studio' : studio.isAnimationStudio ? 'Animation studio' : 'Producer'}
                  </p>
                </div>
              </Link>
            ))}
            {media.staff.edges.map((edge, i) => (
              <StaffCard key={`${edge.node.id}-${i}`} staff={edge.node} role={edge.role} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="-mx-4 -mt-5 h-72 animate-pulse bg-muted md:-mx-6 md:h-80" />
      <div className="h-20 animate-pulse rounded-3xl border border-white/10 bg-card" />
      <div className="h-52 animate-pulse rounded-3xl border border-white/10 bg-card" />
    </div>
  )
}
