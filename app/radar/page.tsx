'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Compass,
  GitBranch,
  Radar,
  RefreshCw,
  Sparkles,
  Star,
  Tv,
} from 'lucide-react'
import { anilist, displayTitle, formatEnum, type MediaCard } from '@/lib/anilist'
import { addToWatchlist, useWatchlist } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

const RADAR_SCAN_QUERY = `
  query RadarScan($ids: [Int]) {
    Page(page: 1, perPage: 35) {
      media(id_in: $ids, type: ANIME) {
        id
        title { romaji english }
        relations {
          edges {
            relationType(version: 2)
            node {
              id
              type
              isAdult
              title { romaji english }
              coverImage { large medium color }
              format
              status
              episodes
              seasonYear
              averageScore
              genres
              nextAiringEpisode { episode airingAt }
            }
          }
        }
        recommendations(perPage: 5, sort: [RATING_DESC, ID]) {
          nodes {
            rating
            mediaRecommendation {
              id
              type
              isAdult
              title { romaji english }
              coverImage { large medium color }
              format
              status
              episodes
              seasonYear
              averageScore
              genres
              nextAiringEpisode { episode airingAt }
            }
          }
        }
      }
    }
  }
`

type RelatedMediaNode = MediaCard & {
  type?: string
  isAdult?: boolean
}

type ScannedSourceMedia = {
  id: number
  title: { romaji: string; english: string | null }
  relations: {
    edges: {
      relationType: string
      node: RelatedMediaNode | null
    }[]
  }
  recommendations: {
    nodes: {
      rating: number
      mediaRecommendation: RelatedMediaNode | null
    }[]
  }
}

type MissingSequelHit = {
  media: RelatedMediaNode
  relationType: string
  fromTitle: string
  fromId: number
}

type BlindSpotHit = {
  media: RelatedMediaNode
  becauseTitle: string
  becauseId: number
  votes: number
}

const RELEVANT_RELATIONS = new Set(['SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'PREQUEL', 'PARENT'])

export default function RadarPage() {
  const watchlist = useWatchlist()
  const [activeTab, setActiveTab] = useState<'sequels' | 'blindspots'>('sequels')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scannedData, setScannedData] = useState<ScannedSourceMedia[]>([])
  const [scanSeed, setScanSeed] = useState(0)

  const watchlistIds = useMemo(() => new Set(watchlist.map((e) => e.id)), [watchlist])

  // Prioritize completed & watching shows with highest user/community scores
  const candidateSourceIds = useMemo(() => {
    const active = watchlist
      .filter((e) => e.status === 'COMPLETED' || e.status === 'WATCHING')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.updatedAt - a.updatedAt)

    const pool = active.length > 0 ? active : watchlist
    if (pool.length <= 30) return pool.map((e) => e.id)

    // Take top 18 + 12 rotated items when user hits Re-Scan
    const top = pool.slice(0, 18).map((e) => e.id)
    const rest = pool.slice(18)
    const offset = (scanSeed * 12) % Math.max(1, rest.length)
    const rotated = [...rest.slice(offset), ...rest.slice(0, offset)].slice(0, 12).map((e) => e.id)
    return Array.from(new Set([...top, ...rotated]))
  }, [watchlist, scanSeed])

  useEffect(() => {
    if (candidateSourceIds.length === 0) {
      setScannedData([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    anilist<{ Page: { media: ScannedSourceMedia[] } }>(RADAR_SCAN_QUERY, {
      ids: candidateSourceIds,
    })
      .then((res) => {
        if (!cancelled) setScannedData(res?.Page?.media ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Radar scan failed.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [candidateSourceIds])

  const { missingSequels, blindSpots } = useMemo(() => {
    const sequelMap = new Map<number, MissingSequelHit>()
    const blindSpotMap = new Map<number, BlindSpotHit>()

    for (const src of scannedData) {
      const srcTitle = displayTitle(src.title)

      // 1. Missing Franchise Sequels / Movies / OVAs
      for (const edge of src.relations.edges) {
        const node = edge.node
        if (!node || node.type !== 'ANIME' || node.isAdult) continue
        if (!RELEVANT_RELATIONS.has(edge.relationType)) continue
        if (watchlistIds.has(node.id)) continue
        if (node.status === 'NOT_YET_RELEASED' && edge.relationType !== 'SEQUEL') continue

        const existing = sequelMap.get(node.id)
        if (!existing || edge.relationType === 'SEQUEL') {
          sequelMap.set(node.id, {
            media: node,
            relationType: edge.relationType,
            fromTitle: srcTitle,
            fromId: src.id,
          })
        }
      }

      // 2. Hidden-Gem Blind-Spot Recommendations
      for (const rec of src.recommendations.nodes) {
        const node = rec.mediaRecommendation
        if (!node || node.type !== 'ANIME' || node.isAdult) continue
        if (watchlistIds.has(node.id)) continue
        if ((node.averageScore ?? 0) < 74) continue

        const existing = blindSpotMap.get(node.id)
        if (!existing || rec.rating > existing.votes) {
          blindSpotMap.set(node.id, {
            media: node,
            becauseTitle: srcTitle,
            becauseId: src.id,
            votes: rec.rating,
          })
        }
      }
    }

    const sortedSequels = Array.from(sequelMap.values()).sort((a, b) => {
      if (a.relationType === 'SEQUEL' && b.relationType !== 'SEQUEL') return -1
      if (b.relationType === 'SEQUEL' && a.relationType !== 'SEQUEL') return 1
      return (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0)
    })

    const sortedBlindSpots = Array.from(blindSpotMap.values())
      .filter((b) => !sequelMap.has(b.media.id))
      .sort((a, b) => b.votes - a.votes || (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))

    return { missingSequels: sortedSequels, blindSpots: sortedBlindSpots }
  }, [scannedData, watchlistIds])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Radar className="size-7 text-primary" />
            Franchise Sequel & Blind-Spot Radar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatically scans your {watchlist.length} watchlist titles to catch missing sequels, movies, and tailored blind spots.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setScanSeed((s) => s + 1)}
          disabled={loading || watchlist.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          {loading ? 'Scanning Library...' : 'Scan Next Batch'}
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('sequels')}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-all',
            activeTab === 'sequels'
              ? 'border-primary bg-primary text-primary-foreground active-pill'
              : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white',
          )}
        >
          <GitBranch className="size-3.5" />
          Missing Sequels & Spin-Offs
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] tabular-nums">
            {missingSequels.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blindspots')}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-all',
            activeTab === 'blindspots'
              ? 'border-primary bg-primary text-primary-foreground active-pill'
              : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white',
          )}
        >
          <Compass className="size-3.5" />
          Tailored Blind Spots
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] tabular-nums">
            {blindSpots.length}
          </span>
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {watchlist.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Add a few anime to your watchlist first so the Radar can scan for sequels and recommendations.
          </p>
          <Link href="/" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
            Browse anime
          </Link>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-card" />
          ))}
        </div>
      ) : activeTab === 'sequels' ? (
        missingSequels.length === 0 ? (
          <div className="glass-panel rounded-3xl p-10 text-center">
            <Sparkles className="mx-auto size-7 text-primary" />
            <p className="mt-2 text-sm font-semibold text-white">No missing sequels in this batch!</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap <strong>Scan Next Batch</strong> above to check more franchises from your library.
            </p>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {missingSequels.map((hit) => {
              const inList = watchlistIds.has(hit.media.id)
              return (
                <div key={hit.media.id} className="glass-card flex gap-3.5 rounded-2xl p-3.5">
                  <Link
                    href={`/anime/${hit.media.id}`}
                    className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                  >
                    <img
                      src={hit.media.coverImage.large || '/placeholder.svg'}
                      alt={displayTitle(hit.media.title)}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                            hit.relationType === 'SEQUEL'
                              ? 'bg-primary text-white'
                              : 'border border-white/10 bg-white/[0.06] text-foreground',
                          )}
                        >
                          {formatEnum(hit.relationType)}
                        </span>
                        {hit.media.averageScore && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-upcoming">
                            <Star className="size-3 fill-upcoming text-upcoming" /> {hit.media.averageScore}%
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/anime/${hit.media.id}`}
                        className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-white hover:text-primary"
                      >
                        {displayTitle(hit.media.title)}
                      </Link>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        Linked to <span className="text-foreground/90">{hit.fromTitle}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {[formatEnum(hit.media.format), hit.media.episodes ? `${hit.media.episodes} eps` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <button
                        type="button"
                        disabled={inList}
                        onClick={() => addToWatchlist(hit.media, 'PLANNING')}
                        className={cn(
                          'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors',
                          inList
                            ? 'bg-airing/15 text-airing'
                            : 'bg-primary/20 text-primary hover:bg-primary hover:text-white',
                        )}
                      >
                        {inList ? (
                          <>
                            <Check className="size-3" /> Added
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="size-3" /> Plan
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : blindSpots.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No new blind-spot matches found in this scan. Tap <strong>Scan Next Batch</strong> to check more titles.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {blindSpots.map((hit) => {
            const inList = watchlistIds.has(hit.media.id)
            return (
              <div key={hit.media.id} className="glass-card flex gap-3.5 rounded-2xl p-3.5">
                <Link
                  href={`/anime/${hit.media.id}`}
                  className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                >
                  <img
                    src={hit.media.coverImage.large || '/placeholder.svg'}
                    alt={displayTitle(hit.media.title)}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {hit.media.averageScore && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-upcoming/15 px-2 py-0.5 text-[10px] font-bold text-upcoming">
                          <Star className="size-3 fill-upcoming text-upcoming" /> {hit.media.averageScore}%
                        </span>
                      )}
                      {hit.media.episodes && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Tv className="size-3" /> {hit.media.episodes} eps
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/anime/${hit.media.id}`}
                      className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-white hover:text-primary"
                    >
                      {displayTitle(hit.media.title)}
                    </Link>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      Because you watched <span className="text-primary">{hit.becauseTitle}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {hit.media.genres.slice(0, 2).join(' · ')}
                    </span>
                    <button
                      type="button"
                      disabled={inList}
                      onClick={() => addToWatchlist(hit.media, 'PLANNING')}
                      className={cn(
                        'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors',
                        inList
                          ? 'bg-airing/15 text-airing'
                          : 'bg-primary/20 text-primary hover:bg-primary hover:text-white',
                      )}
                    >
                      {inList ? (
                        <>
                          <Check className="size-3" /> Added
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="size-3" /> Plan
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
