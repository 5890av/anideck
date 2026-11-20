'use client'

import { useEffect, useState } from 'react'
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
  youtubeId?: string | null
}

async function fetchThemesViaServer(
  searchTitle: string,
  seasonYear?: number | null,
): Promise<{ themes: AnimeThemeItem[]; debug?: string }> {
  try {
    const params = new URLSearchParams({ title: searchTitle })
    if (seasonYear) params.set('year', String(seasonYear))
    const res = await fetch(`/api/themes?${params.toString()}`)
    if (!res.ok) return { themes: [], debug: `Route HTTP ${res.status}` }
    const json = await res.json()
    const themes = Array.isArray(json?.themes) ? json.themes : []
    return {
      themes,
      debug: themes.length === 0 ? json?.error || 'No themes found' : undefined,
    }
  } catch (err: any) {
    return { themes: [], debug: err?.message || 'Fetch error' }
  }
}

export function AnimeDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Media: MediaDetail }>([MEDIA_DETAIL_QUERY, { id }])
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [themes, setThemes] = useState<AnimeThemeItem[]>([])
  const [themesDebug, setThemesDebug] = useState<string | undefined>(undefined)
  const [themesLoading, setThemesLoading] = useState(true)
  const [playingTheme, setPlayingTheme] = useState<AnimeThemeItem | null>(null)
  const [resolvingVideo, setResolvingVideo] = useState(false)

  const media = data?.Media
  const queryTitle = media?.title?.romaji || media?.title?.english || ''
  const seasonYear = media?.seasonYear ?? null

  useEffect(() => {
    if (!queryTitle) return
    let active = true
    setThemesLoading(true)
    setThemes([])
    setThemesDebug(undefined)
    setPlayingTheme(null)

    fetchThemesViaServer(queryTitle, seasonYear)
      .then((res) => {
        if (active) {
          setThemes(res.themes)
          setThemesDebug(res.debug)
        }
      })
      .finally(() => {
        if (active) setThemesLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, queryTitle, seasonYear])

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

  const bentoStats = [
    {
      label: 'Community Score',
      value: media.averageScore != null ? `${media.averageScore}%` : '—',
      accent: 'text-upcoming',
    },
    {
      label: 'Episodes',
      value: media.episodes ? `${media.episodes} Eps` : 'Ongoing',
      accent: 'text-white',
    },
    {
      label: 'Format',
      value: formatEnum(media.format) || 'TV',
      accent: 'text-white',
    },
    {
      label: 'Season',
      value:
        [formatEnum(media.season), media.seasonYear].filter(Boolean).join(' ') ||
        formatFuzzyDate(media.startDate) ||
        '—',
      accent: 'text-primary',
    },
    {
      label: 'Active Fans',
      value: media.popularity ? media.popularity.toLocaleString() : '—',
      accent: 'text-white',
    },
  ]

  const buildYouTubeUrl = (theme: AnimeThemeItem) => {
    if (theme.youtubeId) {
      return `https://www.youtube.com/watch?v=${theme.youtubeId}`
    }
    const q = [title, theme.slug, theme.songTitle, ...theme.artists].filter(Boolean).join(' ')
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  }

  const handlePlayTheme = async (theme: AnimeThemeItem) => {
    if (playingTheme?.id === theme.id) {
      setPlayingTheme(null)
      return
    }

    setPlayingTheme(theme)

    if (theme.videoUrl || theme.youtubeId) return

    setResolvingVideo(true)
    try {
      const cleanSong = theme.songTitle.replace(/\([^)]*\)/g, '').trim()
      const cleanArtist = theme.artists[0]?.replace(/\([^)]*\)/g, '').trim() || ''
      const playQuery = `${title} ${theme.slug} ${cleanSong} ${cleanArtist} creditless`.trim()
      const res = await fetch(`/api/themes?playQuery=${encodeURIComponent(playQuery)}`)
      if (res.ok) {
        const json = await res.json()
        const resolvedId: string | null = json?.youtubeId ?? null
        if (resolvedId) {
          setThemes((prev) =>
            prev.map((item) => (item.id === theme.id ? { ...item, youtubeId: resolvedId } : item)),
          )
          setPlayingTheme((curr) =>
            curr?.id === theme.id ? { ...curr, youtubeId: resolvedId } : curr,
          )
        }
      }
    } finally {
      setResolvingVideo(false)
    }
  }

  return (
    <article className="flex flex-col gap-6">
      {/* Full-Bleed Editorial Widescreen Banner */}
      <div className="relative -mx-4 -mt-5 overflow-hidden border-b border-white/10 md:-mx-6">
        <div className="relative h-60 w-full sm:h-72 md:h-80">
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
            className="absolute inset-0 bg-gradient-to-t from-[#0E1015] via-[#0E1015]/60 to-[#0E1015]/25"
          />

          {/* Top Floating Nav Controls */}
          <div className="absolute inset-x-0 top-4 z-20 mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#161922]/80 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-xl transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
            </Link>

            <Link
              href="/dna"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold active-pill transition-transform hover:scale-105"
            >
              <Dna className="size-3.5" aria-hidden="true" /> DNA Match
            </Link>
          </div>
        </div>

        {/* Overlapping Poster + Title Stage */}
        <div className="relative z-10 mx-auto -mt-28 max-w-7xl px-4 pb-6 sm:-mt-32 md:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {/* Coral-Framed Elevated Poster Card */}
            {media.coverImage.large && (
              <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-44 md:w-52">
                <div className="overflow-hidden rounded-3xl border-2 border-[#FF6B4A]/45 bg-muted shadow-[0_24px_54px_rgba(0,0,0,0.85)]">
                  <img
                    src={media.coverImage.large}
                    alt={`${title} cover art`}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Title, Studios & Editorial Badges */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <StatusBadge status={media.status} />
                {media.averageScore != null && (
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-extrabold amber-pill">
                    <Star className="size-3.5 fill-current" aria-hidden="true" />
                    {media.averageScore}% Score
                  </span>
                )}
                {media.status === 'RELEASING' && media.nextAiringEpisode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-airing/35 bg-airing/15 px-3 py-0.5 text-xs font-bold text-airing">
                    <AiringCountdown next={media.nextAiringEpisode} />
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-balance text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
                  {title}
                </h1>
                {media.title.native && (
                  <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">{media.title.native}</p>
                )}
              </div>

              {/* Main Studio & Duration Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {mainStudios.map(({ node }) => (
                  <Link
                    key={node.id}
                    href={`/studio/${node.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold active-pill transition-transform hover:scale-105"
                  >
                    <Building2 className="size-3" aria-hidden="true" />
                    {node.name}
                  </Link>
                ))}
                {media.duration && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#161922]/85 px-3 py-1 text-xs font-semibold text-slate-200">
                    <Clock className="size-3 text-primary" aria-hidden="true" />
                    {media.duration} min/ep
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 5-Column Editorial Bento Stats Bar */}
          <div className="bento-stat mt-6 grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-5">
            {bentoStats.map((stat, idx) => (
              <div
                key={stat.label}
                className={cn(
                  'p-3.5',
                  idx < bentoStats.length - 1 && 'border-b border-white/10 sm:border-b-0 sm:border-r',
                )}
              >
                <p className={cn('truncate text-base font-extrabold', stat.accent)}>{stat.value}</p>
                <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Glass Watchlist & Streaming Dock */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-3xl p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <WatchlistControls media={media} />
        </div>

        {streaming.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Stream:
            </span>
            {streaming.slice(0, 4).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#161922]/85 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:border-primary/50 hover:text-primary"
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

      {/* Interactive Editorial Stage Switcher Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-[#161922]/85 p-1">
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
                    ? 'active-pill'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
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
              className="rounded-full border border-white/10 bg-[#161922]/80 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/45 hover:text-primary"
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
              <div className="flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
                <h2 className="text-base font-extrabold uppercase tracking-wider text-white">
                  Story &amp; Synopsis
                </h2>
              </div>
              {media.source && (
                <span className="rounded-full px-3 py-0.5 text-[11px] font-extrabold amber-pill">
                  Adapted from {formatEnum(media.source)}
                </span>
              )}
            </div>
            <RichDescription text={media.description} className="text-sm leading-relaxed text-slate-200" />

            {/* Mobile Genre Chips */}
            {media.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-4 md:hidden">
                {media.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/search?genre=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/10 bg-[#161922] px-3 py-1 text-xs font-semibold text-slate-200"
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
          {playingTheme && (
            <div className="glass-panel overflow-hidden rounded-3xl border-primary/45 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold active-pill">
                    {playingTheme.slug}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{playingTheme.songTitle}</p>
                    {playingTheme.artists.length > 0 && (
                      <p className="truncate text-xs text-slate-400">
                        by {playingTheme.artists.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={buildYouTubeUrl(playingTheme)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold amber-pill transition-transform hover:scale-105"
                  >
                    YouTube <ExternalLink className="size-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPlayingTheme(null)}
                    aria-label="Close theme player"
                    className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-[#161922] text-slate-300 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {playingTheme.videoUrl ? (
                <video
                  key={playingTheme.videoUrl}
                  src={playingTheme.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="aspect-video max-h-96 w-full rounded-2xl bg-black object-contain"
                />
              ) : resolvingVideo ? (
                <div className="flex aspect-video max-h-96 w-full items-center justify-center rounded-2xl bg-black/80 text-xs font-semibold text-slate-300">
                  Finding playable stream...
                </div>
              ) : playingTheme.youtubeId ? (
                <iframe
                  key={playingTheme.youtubeId}
                  src={`https://www.youtube.com/embed/${playingTheme.youtubeId}?autoplay=1&rel=0`}
                  title={`${playingTheme.slug} - ${playingTheme.songTitle}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-video max-h-96 w-full rounded-2xl border-0 bg-black"
                />
              ) : (
                <div className="flex aspect-video max-h-72 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-black/80 p-6 text-center">
                  <p className="text-xs text-slate-300">
                    Embed restricted by copyright holder. Watch directly on YouTube:
                  </p>
                  <a
                    href={buildYouTubeUrl(playingTheme)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold active-pill"
                  >
                    <Play className="size-3.5 fill-current" /> Open on YouTube
                  </a>
                </div>
              )}
            </div>
          )}

          {themesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
              <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
            </div>
          ) : themes.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-sm text-slate-400">
              <p>No opening or ending theme songs indexed yet for this title.</p>
              {themesDebug && (
                <p className="mt-2 font-mono text-xs text-primary">Status: {themesDebug}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Openings Column */}
              <div className="glass-panel flex flex-col gap-3 rounded-3xl p-5">
                <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-primary">
                  <Volume2 className="size-4" /> Openings ({openings.length})
                </h3>
                {openings.length === 0 ? (
                  <p className="text-xs text-slate-400">No opening themes listed.</p>
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
                              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-primary">
                                {op.slug}
                              </span>
                              {op.episodes && (
                                <span className="text-[11px] font-medium text-slate-400">Eps {op.episodes}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-white">{op.songTitle}</p>
                            {op.artists.length > 0 && (
                              <p className="truncate text-[11px] text-slate-400">
                                {op.artists.join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlayTheme(op)}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[11px] font-extrabold active-pill transition-transform hover:scale-105"
                          >
                            <Play className="size-3 fill-current" />
                            {isPlaying ? 'Playing' : 'Play'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Endings Column */}
              <div className="glass-panel flex flex-col gap-3 rounded-3xl p-5">
                <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-upcoming">
                  <Music className="size-4" /> Endings ({endings.length})
                </h3>
                {endings.length === 0 ? (
                  <p className="text-xs text-slate-400">No ending themes listed.</p>
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
                              <span className="rounded-full bg-[#FFB84D]/20 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-upcoming">
                                {ed.slug}
                              </span>
                              {ed.episodes && (
                                <span className="text-[11px] font-medium text-slate-400">Eps {ed.episodes}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-white">{ed.songTitle}</p>
                            {ed.artists.length > 0 && (
                              <p className="truncate text-[11px] text-slate-400">
                                {ed.artists.join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlayTheme(ed)}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[11px] font-extrabold active-pill transition-transform hover:scale-105"
                          >
                            <Play className="size-3 fill-current" />
                            {isPlaying ? 'Playing' : 'Play'}
                          </button>
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
            <div className="glass-panel rounded-3xl p-8 text-center text-sm text-slate-400">
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
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#161922]">
                  <Building2 className="size-5 text-slate-400 group-hover:text-primary" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col justify-center">
                  <p className="truncate text-sm font-bold text-white group-hover:text-primary">{studio.name}</p>
                  <p className="text-xs text-slate-400">
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
