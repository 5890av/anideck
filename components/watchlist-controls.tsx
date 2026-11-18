'use client'

import { Check, Plus, Trash2 } from 'lucide-react'
import type { MediaCard } from '@/lib/anilist'
import {
  addToWatchlist,
  incrementProgress,
  removeFromWatchlist,
  updateEntry,
  useWatchEntry,
  WATCH_STATUSES,
  type WatchEntry,
  type WatchStatus,
} from '@/lib/watchlist'
import { cn } from '@/lib/utils'

export function WatchlistControls({ media }: { media: MediaCard }) {
  const entry = useWatchEntry(media.id)

  if (!entry) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addToWatchlist(media, 'PLANNING')}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Plus className="size-4" aria-hidden="true" /> Add to Watchlist
        </button>
        {media.status !== 'NOT_YET_RELEASED' && (
          <button
            type="button"
            onClick={() => addToWatchlist(media, 'WATCHING')}
            className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
          >
            Start watching
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Check className="size-3.5" aria-hidden="true" /> In your watchlist
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <StatusSelect entry={entry} />
        <ProgressButton entry={entry} />
        <ScoreSelect entry={entry} />
        <button
          type="button"
          onClick={() => removeFromWatchlist(entry.id)}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label="Remove from watchlist"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

const selectClass =
  'h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-primary'

export function StatusSelect({ entry, className }: { entry: WatchEntry; className?: string }) {
  return (
    <label className={className}>
      <span className="sr-only">Watch status</span>
      <select
        value={entry.status}
        onChange={(e) => {
          const status = e.target.value as WatchStatus
          updateEntry(entry.id, {
            status,
            progress: status === 'COMPLETED' && entry.episodes ? entry.episodes : entry.progress,
          })
        }}
        className={selectClass}
      >
        {WATCH_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ScoreSelect({ entry, className }: { entry: WatchEntry; className?: string }) {
  return (
    <label className={className}>
      <span className="sr-only">Your rating</span>
      <select
        value={entry.score ?? ''}
        onChange={(e) => updateEntry(entry.id, { score: e.target.value ? Number(e.target.value) : null })}
        className={selectClass}
      >
        <option value="">Rate…</option>
        {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
          <option key={n} value={n}>
            {n} / 10
          </option>
        ))}
      </select>
    </label>
  )
}

export function ProgressButton({ entry }: { entry: WatchEntry }) {
  const done = entry.episodes !== null && entry.progress >= entry.episodes
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-lg border border-input bg-card">
      <span className="px-2.5 font-mono text-sm tabular-nums" aria-label={`Progress ${entry.progress} of ${entry.episodes ?? 'unknown'} episodes`}>
        {entry.progress} / {entry.episodes ?? '?'} eps
      </span>
      <button
        type="button"
        onClick={() => incrementProgress(entry.id)}
        disabled={done}
        className={cn(
          'h-full border-l border-input px-2.5 text-sm font-semibold transition-colors',
          done ? 'text-muted-foreground' : 'text-primary hover:bg-primary hover:text-primary-foreground',
        )}
        aria-label="Add one watched episode"
      >
        +1 Ep
      </button>
    </div>
  )
}
