'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { updateEntry, type WatchEntry } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

export function formatScore(score: number | null) {
  if (score == null) return '—'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

export function ScorePicker({
  entry,
  communityScore,
  size = 'md',
}: {
  entry: WatchEntry
  communityScore: number | null
  size?: 'sm' | 'md'
}) {
  const [hover, setHover] = useState<number | null>(null)
  const score = entry.score
  const whole = score == null ? null : Math.floor(score)
  const hasHalf = score != null && !Number.isInteger(score)
  const shown = hover ?? whole

  const set = (value: number | null) => updateEntry(entry.id, { score: value })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ScoreComparison mine={score} community={communityScore} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div
          role="group"
          aria-label="Your score from 1 to 10"
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = shown != null && n <= shown
            const exact = whole === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={exact}
                aria-label={`Rate ${n}${exact && hasHalf ? '.5' : ''} out of 10`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => set(exact && !hasHalf ? null : n)}
                className={cn(
                  'flex items-center justify-center rounded-md font-mono font-semibold tabular-nums transition-colors',
                  size === 'sm' ? 'h-7 w-6 text-[11px]' : 'h-8 w-7 text-xs',
                  active
                    ? 'bg-upcoming text-background'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          aria-pressed={hasHalf}
          disabled={whole == null || whole >= 10}
          onClick={() => whole != null && set(hasHalf ? whole : whole + 0.5)}
          className={cn(
            'rounded-md border px-2 font-mono text-xs font-semibold transition-colors disabled:opacity-40',
            size === 'sm' ? 'h-7' : 'h-8',
            hasHalf
              ? 'border-upcoming bg-upcoming/15 text-upcoming'
              : 'border-input text-muted-foreground hover:text-foreground',
          )}
          title="Add half a point"
        >
          +.5
        </button>
        {score != null && (
          <button
            type="button"
            onClick={() => set(null)}
            className={cn(
              'flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
              size === 'sm' ? 'size-7' : 'size-8',
            )}
            aria-label="Clear your score"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ScoreComparison({ mine, community }: { mine: number | null; community: number | null }) {
  return (
    <dl className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">My score</dt>
        <dd className="flex items-center gap-1 font-mono text-sm font-semibold text-upcoming tabular-nums">
          <Star className="size-3.5 fill-upcoming" aria-hidden="true" />
          {formatScore(mine)}
        </dd>
      </div>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">AniList</dt>
        <dd className="font-mono text-sm font-semibold tabular-nums">
          {community != null ? (community / 10).toFixed(1) : '—'}
        </dd>
      </div>
    </dl>
  )
}
