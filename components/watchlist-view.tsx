'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Trash2, Upload } from 'lucide-react'
import {
  exportWatchlist,
  importWatchlist,
  removeFromWatchlist,
  useWatchlist,
  WATCH_STATUSES,
  type WatchStatus,
} from '@/lib/watchlist'
import { formatEnum } from '@/lib/anilist'
import { cn } from '@/lib/utils'
import type { WatchEntry } from '@/lib/watchlist'
import { ProgressButton, StatusSelect } from './watchlist-controls'
import { ScorePicker } from './score-picker'
import { ConnectAniListButton } from './connect-anilist'

type SortKey = 'updated' | 'myScore' | 'communityScore' | 'title' | 'progress'

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
    return {
      episodes: list.reduce((n, e) => n + e.progress, 0),
      mean: scored.length ? (scored.reduce((n, e) => n + (e.score ?? 0), 0) / scored.length).toFixed(1) : '—',
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
            {list.length} titles · {stats.episodes} episodes watched · mean score {stats.mean}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
                    <img src={entry.coverImage || "/placeholder.svg"} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded-md object-cover" />
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
    </div>
  )
}
