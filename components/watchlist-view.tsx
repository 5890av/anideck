'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Award,
  BarChart3,
  Clock,
  Download,
  Film,
  Flame,
  ListChecks,
  Star,
  Trash2,
  Tv,
  Upload,
} from 'lucide-react'
import {
  exportWatchlist,
  importWatchlist,
  removeFromWatchlist,
  useWatchlist,
  WATCH_STATUSES,
  type WatchEntry,
  type WatchStatus,
} from '@/lib/watchlist'
import { formatEnum } from '@/lib/anilist'
import { cn } from '@/lib/utils'
import { ProgressButton, StatusSelect } from './watchlist-controls'
import { ScorePicker } from './score-picker'
import { ConnectAniListButton } from './connect-anilist'

type SortKey = 'updated' | 'myScore' | 'communityScore' | 'title' | 'progress'
type ViewMode = 'list' | 'stats'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'myScore', label: 'My score' },
  { value: 'communityScore', label: 'AniList score' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'progress', label: 'Progress' },
]

const byNullableDesc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1)

const SORTERS: Record<SortKey, (a: WatchEntry, b: WatchEntry) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  myScore: (a, b) => byNullableDesc(a.score, b.score) || b.updatedAt - a.updatedAt,
  communityScore: (a, b) => byNullableDesc(a.averageScore, b.averageScore) || a.title.localeCompare(b.title),
  title: (a, b) => a.title.localeCompare(b.title),
  progress: (a, b) =>
    byNullableDesc(a.episodes ? a.progress / a.episodes : null, b.episodes ? b.progress / b.episodes : null) ||
    b.progress - a.progress,
}

export function WatchlistView() {
  const list = useWatchlist()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filter, setFilter] = useState<WatchStatus | 'ALL'>('ALL')
  const [sort, setSort] = useState<SortKey>('updated')
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => {
    const c = Object.fromEntries(WATCH_STATUSES.map((s) => [s.value, 0])) as Record<WatchStatus, number>
    list.forEach((e) => c[e.status]++)
    return c
  }, [list])

  const stats = useMemo(() => {
    const scored = list.filter((e) => e.score != null)
    const episodes = list.reduce((n, e) => n + e.progress, 0)
    const meanNum = scored.length ? scored.reduce((n, e) => n + (e.score ?? 0), 0) / scored.length : null
    return {
      episodes,
      mean: meanNum !== null ? meanNum.toFixed(1) : '—',
      meanNum,
      scoredCount: scored.length,
    }
  }, [list])

  const visible = [...list].filter((e) => filter === 'ALL' || e.status === filter).sort(SORTERS[sort])

  const handleExport = () => {
    const blob = new Blob([exportWatchlist()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anideck-watchlist-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File) => {
    try {
      const n = importWatchlist(await file.text())
      setMessage(`Imported ${n} ${n === 1 ? 'entry' : 'entries'}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">My Watchlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length} titles · {stats.episodes.toLocaleString()} episodes watched · mean score {stats.mean}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Watchlist view mode"
            className="flex gap-1 rounded-lg border border-border bg-card p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'stats'}
              onClick={() => setViewMode('stats')}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                viewMode === 'stats'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Stats & Taste
            </button>
          </div>

          <ConnectAniListButton variant="inline" />
          <button
            type="button"
            onClick={handleExport}
            disabled={list.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden="true" /> Export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            <Upload className="size-4" aria-hidden="true" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm">
          {message}
        </p>
      )}

      {viewMode === 'stats' ? (
        <TasteProfileDashboard list={list} counts={counts} stats={stats} />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {[{ value: 'ALL' as const, label: 'All' }, ...WATCH_STATUSES].map((s) => {
                const count = s.value === 'ALL' ? list.length : counts[s.value]
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === s.value}
                    onClick={() => setFilter(s.value)}
                    className={cn(
                      'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                      filter === s.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s.label}
                    <span className="text-xs opacity-75">{count}</span>
                  </button>
                )
              })}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {list.length === 0 ? 'Your watchlist is empty.' : 'Nothing in this category yet.'}
              </p>
              <Link href="/" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Browse anime
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((entry) => {
                const pct = entry.episodes ? Math.min(100, (entry.progress / entry.episodes) * 100) : 0
                return (
                  <li key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Link href={`/anime/${entry.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {entry.coverImage ? (
                          <img
                            src={entry.coverImage || '/placeholder.svg'}
                            alt=""
                            loading="lazy"
                            className="h-20 w-14 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-20 w-14 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className="truncate font-medium hover:text-primary">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[formatEnum(entry.format), entry.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                          </p>
                          {entry.episodes ? (
                            <div
                              className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={entry.episodes}
                              aria-valuenow={entry.progress}
                              aria-label="Watch progress"
                            >
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusSelect entry={entry} />
                        <ProgressButton entry={entry} />
                        <button
                          type="button"
                          onClick={() => removeFromWatchlist(entry.id)}
                          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          aria-label={`Remove ${entry.title}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <ScorePicker entry={entry} communityScore={entry.averageScore} size="sm" />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<WatchStatus, string> = {
  WATCHING: 'bg-airing',
  COMPLETED: 'bg-primary',
  PLANNING: 'bg-upcoming',
  PAUSED: 'bg-muted-foreground',
  DROPPED: 'bg-destructive',
}

function TasteProfileDashboard({
  list,
  counts,
  stats,
}: {
  list: WatchEntry[]
  counts: Record<WatchStatus, number>
  stats: { episodes: number; mean: string; meanNum: number | null; scoredCount: number }
}) {
  const analytics = useMemo(() => {
    const totalMinutes = list.reduce((sum, e) => {
      const minsPerEp = e.format === 'MOVIE' ? 105 : e.format === 'TV_SHORT' ? 10 : 24
      return sum + e.progress * minsPerEp
    }, 0)
    const hoursWatched = Math.round(totalMinutes / 60)
    const daysWatched = (totalMinutes / 1440).toFixed(1)
    const completionRate = list.length ? Math.round((counts.COMPLETED / list.length) * 100) : 0

    // Genre breakdown
    const genreMap = new Map<string, { count: number; scoreSum: number; scored: number }>()
    for (const e of list) {
      if (e.status === 'PLANNING' && e.progress === 0) continue
      for (const g of e.genres) {
        const cur = genreMap.get(g) ?? { count: 0, scoreSum: 0, scored: 0 }
        cur.count++
        if (e.score != null) {
          cur.scoreSum += e.score
          cur.scored++
        }
        genreMap.set(g, cur)
      }
    }
    const topGenres = Array.from(genreMap.entries())
      .map(([genre, v]) => ({
        genre,
        count: v.count,
        avgScore: v.scored > 0 ? (v.scoreSum / v.scored).toFixed(1) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Score distribution (1 to 10)
    const buckets = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }))
    for (const e of list) {
      if (e.score != null) {
        const idx = Math.min(9, Math.max(0, Math.round(e.score) - 1))
        buckets[idx].count++
      }
    }

    // Format breakdown
    const formatMap = new Map<string, number>()
    for (const e of list) {
      const label = formatEnum(e.format) ?? 'Other'
      formatMap.set(label, (formatMap.get(label) ?? 0) + 1)
    }
    const formats = Array.from(formatMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    // Top rated shows
    const topRated = [...list]
      .filter((e) => e.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.averageScore ?? 0) - (a.averageScore ?? 0))
      .slice(0, 6)

    // Taste personality badge
    const topGenreName = topGenres[0]?.genre ?? 'Eclectic'
    const persona =
      topGenreName === 'Action' || topGenreName === 'Adventure'
        ? 'Adrenaline & Shonen Enthusiast'
        : topGenreName === 'Psychological' || topGenreName === 'Thriller' || topGenreName === 'Mystery'
          ? 'Mind-Bender & Dark Suspense Connoisseur'
          : topGenreName === 'Fantasy'
            ? 'World-Builder & Fantasy Explorer'
            : topGenreName === 'Romance' || topGenreName === 'Drama' || topGenreName === 'Slice of Life'
              ? 'Character-Driven Storyteller'
              : `${topGenreName} Aficionado`

    return {
      hoursWatched,
      daysWatched,
      completionRate,
      topGenres,
      buckets,
      formats,
      topRated,
      persona,
    }
  }, [list, counts])

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">Add anime to your watchlist or connect AniList to unlock your Taste Profile.</p>
        <Link href="/" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
          Discover anime
        </Link>
      </div>
    )
  }

  const maxGenreCount = analytics.topGenres[0]?.count ?? 1
  const maxBucketCount = Math.max(1, ...analytics.buckets.map((b) => b.count))

  return (
    <div className="flex flex-col gap-6">
      {/* Taste Persona Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-card to-card p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Flame className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Your Anime Taste Profile</p>
            <h2 className="text-lg font-bold tracking-tight md:text-xl">{analytics.persona}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {analytics.topGenres.slice(0, 3).map((g, i) => (
            <span
              key={g.genre}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium"
            >
              <span className="text-primary font-bold">#{i + 1}</span> {g.genre}
            </span>
          ))}
        </div>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Film className="size-4 text-primary" aria-hidden="true" /> Total Titles
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{list.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{analytics.completionRate}% completed</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tv className="size-4 text-primary" aria-hidden="true" /> Episodes Watched
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats.episodes.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{counts.WATCHING} active now</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" /> Est. Watch Time
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{analytics.daysWatched}d</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{analytics.hoursWatched.toLocaleString()} hours</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Star className="size-4 text-primary" aria-hidden="true" /> Mean Score
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats.mean}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{stats.scoredCount} titles rated</p>
        </div>
      </div>

      {/* Status Distribution Stacked Bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Library Breakdown</h3>
          <span className="text-xs text-muted-foreground">{list.length} total</span>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-secondary">
          {WATCH_STATUSES.map((s) => {
            const count = counts[s.value]
            if (!count) return null
            const widthPct = (count / list.length) * 100
            return (
              <div
                key={s.value}
                title={`${s.label}: ${count}`}
                className={cn('h-full transition-all', STATUS_COLORS[s.value])}
                style={{ width: `${widthPct}%` }}
              />
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {WATCH_STATUSES.map((s) => (
            <div key={s.value} className="flex items-center gap-2 text-xs">
              <span className={cn('size-2.5 rounded-full', STATUS_COLORS[s.value])} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold tabular-nums">{counts[s.value]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Charts: Genre Affinity & Score Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Genres */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top Genres Watched</h3>
            <span className="text-xs text-muted-foreground">Count · Avg Score</span>
          </div>
          {analytics.topGenres.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Start watching shows to see your genre stats.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {analytics.topGenres.map((g) => (
                <div key={g.genre} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{g.genre}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {g.count} {g.avgScore ? `· ★ ${g.avgScore}` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Distribution & Formats */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Score Distribution</h3>
              <span className="text-xs text-muted-foreground">1–10 Scale</span>
            </div>
            {stats.scoredCount === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Rate anime in your watchlist to see your score curve.
              </p>
            ) : (
              <div className="mt-4 flex h-32 items-end gap-1.5 pt-4">
                {analytics.buckets.map((b) => {
                  const heightPct = b.count > 0 ? Math.max(12, Math.round((b.count / maxBucketCount) * 100)) : 4
                  return (
                    <div key={b.score} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {b.count > 0 ? b.count : ''}
                      </span>
                      <div className="flex h-20 w-full items-end">
                        <div
                          className={cn(
                            'w-full rounded-t-md transition-all',
                            b.count > 0 ? 'bg-primary' : 'bg-secondary/70',
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{b.score}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formats</h4>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {analytics.formats.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">{f.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Highest Rated Anime */}
      {analytics.topRated.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-base font-semibold">Your Highest-Rated Anime</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {analytics.topRated.map((entry) => (
              <Link key={entry.id} href={`/anime/${entry.id}`} className="group flex flex-col gap-1.5">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={entry.coverImage || '/placeholder.svg'}
                    alt={entry.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/85 px-2 py-0.5 text-xs font-bold text-primary backdrop-blur-xs">
                    <Star className="size-3 fill-primary text-primary" /> {entry.score}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs font-medium group-hover:text-primary">{entry.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
