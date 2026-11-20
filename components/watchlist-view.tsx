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
  SlidersHorizontal,
  Sparkles,
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
  { value: 'updated', label: 'Recent' },
  { value: 'myScore', label: 'My Score' },
  { value: 'communityScore', label: 'AniList Score' },
  { value: 'title', label: 'A–Z' },
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
    const totalMinutes = list.reduce((sum, e) => {
      const minsPerEp = e.format === 'MOVIE' ? 105 : e.format === 'TV_SHORT' ? 10 : 24
      return sum + e.progress * minsPerEp
    }, 0)
    return {
      episodes,
      mean: meanNum !== null ? meanNum.toFixed(1) : '—',
      meanNum,
      scoredCount: scored.length,
      hoursWatched: Math.round(totalMinutes / 60),
      daysWatched: (totalMinutes / 1440).toFixed(1),
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
      {/* Editorial Library Command Header + 4-Cell Bento Strip */}
      <div className="glass-panel flex flex-col gap-5 rounded-3xl p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-6 w-1.5 rounded-full active-pill" aria-hidden="true" />
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">My Library</h1>
              <span className="rounded-full px-3 py-0.5 text-xs font-extrabold amber-pill">
                {list.length} Titles
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 sm:text-sm">
              Track progress, rate series, and explore your personal anime taste analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* List vs Taste Analytics Pill Switch */}
            <div
              role="tablist"
              aria-label="Watchlist view mode"
              className="flex gap-1 rounded-full border border-white/12 bg-[#0E1015]/85 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition-all',
                  viewMode === 'list' ? 'active-pill' : 'text-slate-400 hover:text-white',
                )}
              >
                <ListChecks className="size-3.5" aria-hidden="true" />
                Gallery
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'stats'}
                onClick={() => setViewMode('stats')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition-all',
                  viewMode === 'stats' ? 'active-pill' : 'text-slate-400 hover:text-white',
                )}
              >
                <BarChart3 className="size-3.5" aria-hidden="true" />
                Taste &amp; Stats
              </button>
            </div>

            <ConnectAniListButton variant="inline" />

            <button
              type="button"
              onClick={handleExport}
              disabled={list.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-[#0E1015]/80 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:border-primary/45 hover:text-primary disabled:opacity-40"
            >
              <Download className="size-3.5" aria-hidden="true" /> Export
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-[#0E1015]/80 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:border-primary/45 hover:text-primary"
            >
              <Upload className="size-3.5" aria-hidden="true" /> Import
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

        {/* 4-Cell Editorial Bento Strip */}
        <div className="bento-stat grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-4">
          <div className="border-b border-r border-white/10 p-3.5 sm:border-b-0">
            <p className="text-lg font-extrabold text-white tabular-nums">{counts.WATCHING}</p>
            <p className="text-[11px] font-medium text-slate-400">Currently Watching</p>
          </div>
          <div className="border-b border-white/10 p-3.5 sm:border-b-0 sm:border-r">
            <p className="text-lg font-extrabold text-primary tabular-nums">{counts.COMPLETED}</p>
            <p className="text-[11px] font-medium text-slate-400">Completed Series</p>
          </div>
          <div className="border-r border-white/10 p-3.5">
            <p className="text-lg font-extrabold text-upcoming tabular-nums">
              {stats.episodes.toLocaleString()}
            </p>
            <p className="text-[11px] font-medium text-slate-400">Episodes ({stats.daysWatched}d)</p>
          </div>
          <div className="p-3.5">
            <p className="text-lg font-extrabold text-white tabular-nums">{stats.mean}</p>
            <p className="text-[11px] font-medium text-slate-400">
              Mean Score ({stats.scoredCount} rated)
            </p>
          </div>
        </div>
      </div>

      {message && (
        <p role="status" className="glass-panel rounded-2xl px-4 py-3 text-xs font-semibold text-primary">
          {message}
        </p>
      )}

      {viewMode === 'stats' ? (
        <TasteProfileDashboard list={list} counts={counts} stats={stats} />
      ) : (
        <>
          {/* Status Filter Pills + Sort Pills */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label="Filter by status"
              className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
            >
              {[{ value: 'ALL' as const, label: 'All' }, ...WATCH_STATUSES].map((s) => {
                const count = s.value === 'ALL' ? list.length : counts[s.value]
                const active = filter === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(s.value)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition-all',
                      active
                        ? 'active-pill'
                        : 'border border-white/10 bg-[#161922]/85 text-slate-300 hover:border-primary/45 hover:text-white',
                    )}
                  >
                    <span>{s.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums',
                        active ? 'bg-black/25 text-white' : 'bg-white/10 text-slate-300',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <SlidersHorizontal className="size-3 text-primary" aria-hidden="true" /> Sort:
              </span>
              {SORT_OPTIONS.map((o) => {
                const active = sort === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSort(o.value)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all',
                      active
                        ? 'amber-pill'
                        : 'border border-white/10 bg-[#161922]/80 text-slate-400 hover:text-white',
                    )}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <p className="text-sm font-medium text-slate-300">
                {list.length === 0 ? 'Your library is empty.' : 'Nothing in this category yet.'}
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-xs font-extrabold active-pill"
              >
                <Sparkles className="size-3.5" /> Discover Anime
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((entry) => {
                const pct = entry.episodes ? Math.min(100, Math.round((entry.progress / entry.episodes) * 100)) : 0
                return (
                  <li
                    key={entry.id}
                    className="glass-card flex flex-col justify-between gap-3.5 rounded-3xl border-[#FF6B4A]/25 p-4"
                  >
                    <div className="flex gap-3.5">
                      <Link
                        href={`/anime/${entry.id}`}
                        className="relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-muted"
                      >
                        {entry.coverImage ? (
                          <img
                            src={entry.coverImage || '/placeholder.svg'}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        ) : null}
                        {entry.score != null && (
                          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold amber-pill">
                            <Star className="size-2.5 fill-current" /> {entry.score}
                          </span>
                        )}
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/anime/${entry.id}`}
                              className="line-clamp-2 text-sm font-extrabold leading-snug text-white transition-colors hover:text-primary"
                            >
                              {entry.title}
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeFromWatchlist(entry.id)}
                              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0E1015]/70 text-slate-400 transition-colors hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive"
                              aria-label={`Remove ${entry.title}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium text-slate-400">
                            {[formatEnum(entry.format), entry.genres.slice(0, 2).join(' · ')].filter(Boolean).join(' • ')}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="font-mono text-slate-300 tabular-nums">
                              Ep {entry.progress}
                              {entry.episodes ? ` / ${entry.episodes}` : ''}
                            </span>
                            {entry.episodes ? (
                              <span className="font-mono text-primary tabular-nums">{pct}%</span>
                            ) : null}
                          </div>
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={entry.episodes ?? Math.max(1, entry.progress)}
                            aria-valuenow={entry.progress}
                            aria-label="Watch progress"
                          >
                            <div
                              className="h-full rounded-full active-pill transition-all duration-300"
                              style={{ width: `${entry.episodes ? pct : entry.progress > 0 ? 50 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                      <StatusSelect entry={entry} />
                      <ProgressButton entry={entry} />
                    </div>

                    <div className="border-t border-white/10 pt-2.5">
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
  COMPLETED: 'bg-[#FF6B4A]',
  PLANNING: 'bg-[#FFB84D]',
  PAUSED: 'bg-slate-400',
  DROPPED: 'bg-destructive',
}

function TasteProfileDashboard({
  list,
  counts,
  stats,
}: {
  list: WatchEntry[]
  counts: Record<WatchStatus, number>
  stats: {
    episodes: number
    mean: string
    meanNum: number | null
    scoredCount: number
    hoursWatched: number
    daysWatched: string
  }
}) {
  const analytics = useMemo(() => {
    const completionRate = list.length ? Math.round((counts.COMPLETED / list.length) * 100) : 0

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

    const buckets = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }))
    for (const e of list) {
      if (e.score != null) {
        const idx = Math.min(9, Math.max(0, Math.round(e.score) - 1))
        buckets[idx].count++
      }
    }

    const formatMap = new Map<string, number>()
    for (const e of list) {
      const label = formatEnum(e.format) ?? 'Other'
      formatMap.set(label, (formatMap.get(label) ?? 0) + 1)
    }
    const formats = Array.from(formatMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    const topRated = [...list]
      .filter((e) => e.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.averageScore ?? 0) - (a.averageScore ?? 0))
      .slice(0, 6)

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
      <div className="glass-panel rounded-3xl p-12 text-center">
        <p className="text-sm text-slate-300">
          Add anime to your watchlist or connect AniList to unlock your Taste Profile.
        </p>
        <Link href="/" className="mt-3 inline-flex rounded-full px-5 py-2 text-xs font-extrabold active-pill">
          Discover Anime
        </Link>
      </div>
    )
  }

  const maxGenreCount = analytics.topGenres[0]?.count ?? 1
  const maxBucketCount = Math.max(1, ...analytics.buckets.map((b) => b.count))

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Editorial Taste Persona Banner */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-3xl border-[#FF6B4A]/35 p-5 sm:flex-row sm:items-center md:p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl active-pill">
            <Flame className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
              Your Anime Taste Profile
            </p>
            <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">{analytics.persona}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {analytics.topGenres.slice(0, 3).map((g, i) => (
            <span
              key={g.genre}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold amber-pill"
            >
              <span>#{i + 1}</span> {g.genre}
            </span>
          ))}
        </div>
      </div>

      {/* 4 Editorial KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Film className="size-4 text-primary" aria-hidden="true" /> Total Titles
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{list.length}</p>
          <p className="mt-0.5 text-xs font-semibold text-primary">{analytics.completionRate}% completed</p>
        </div>

        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Tv className="size-4 text-primary" aria-hidden="true" /> Episodes Watched
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{stats.episodes.toLocaleString()}</p>
          <p className="mt-0.5 text-xs font-semibold text-airing">{counts.WATCHING} active now</p>
        </div>

        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Clock className="size-4 text-upcoming" aria-hidden="true" /> Est. Watch Time
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{stats.daysWatched}d</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">
            {stats.hoursWatched.toLocaleString()} hours
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Star className="size-4 text-upcoming" aria-hidden="true" /> Mean Score
          </div>
          <p className="mt-2 text-2xl font-black text-upcoming tabular-nums">{stats.mean}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">{stats.scoredCount} titles rated</p>
        </div>
      </div>

      {/* Library Status Distribution */}
      <div className="glass-panel rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Library Breakdown</h3>
          <span className="text-xs font-bold text-slate-400">{list.length} total</span>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/10">
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
        <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
          {WATCH_STATUSES.map((s) => (
            <div key={s.value} className="flex items-center gap-2 text-xs font-semibold">
              <span className={cn('size-2.5 rounded-full', STATUS_COLORS[s.value])} />
              <span className="text-slate-400">{s.label}</span>
              <span className="font-extrabold text-white tabular-nums">{counts[s.value]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Charts: Genre Affinity & Score Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel flex flex-col gap-3 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Top Genres Watched</h3>
            <span className="text-xs font-semibold text-slate-400">Count · Avg Score</span>
          </div>
          {analytics.topGenres.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Start watching shows to see your genre stats.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {analytics.topGenres.map((g) => (
                <div key={g.genre} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{g.genre}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {g.count} {g.avgScore ? `· ★ ${g.avgScore}` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full active-pill transition-all"
                      style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel flex flex-col justify-between gap-5 rounded-3xl p-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Score Distribution</h3>
              <span className="text-xs font-semibold text-slate-400">1–10 Scale</span>
            </div>
            {stats.scoredCount === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Rate anime in your watchlist to see your score curve.
              </p>
            ) : (
              <div className="mt-4 flex h-32 items-end gap-1.5 pt-4">
                {analytics.buckets.map((b) => {
                  const heightPct = b.count > 0 ? Math.max(14, Math.round((b.count / maxBucketCount) * 100)) : 5
                  return (
                    <div key={b.score} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                        {b.count > 0 ? b.count : ''}
                      </span>
                      <div className="flex h-20 w-full items-end">
                        <div
                          className={cn(
                            'w-full rounded-t-lg transition-all',
                            b.count > 0 ? 'active-pill' : 'bg-white/10',
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-400 tabular-nums">{b.score}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Formats</h4>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {analytics.formats.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#0E1015]/80 px-3 py-1 text-xs"
                >
                  <span className="font-bold text-white">{f.label}</span>
                  <span className="font-mono font-bold text-primary tabular-nums">{f.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Highest Rated Anime */}
      {analytics.topRated.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
            <Award className="size-4 text-upcoming" aria-hidden="true" />
            <h3 className="text-base font-extrabold uppercase tracking-wider text-white">
              Your Highest-Rated Anime
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {analytics.topRated.map((entry) => (
              <Link
                key={entry.id}
                href={`/anime/${entry.id}`}
                className="glass-card group flex flex-col gap-2 rounded-3xl border-[#FF6B4A]/30 p-2.5"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={entry.coverImage || '/placeholder.svg'}
                    alt={entry.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold amber-pill">
                    <Star className="size-3 fill-current" /> {entry.score}
                  </span>
                </div>
                <p className="line-clamp-1 px-1 text-xs font-bold text-white group-hover:text-primary">
                  {entry.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
