'use client'

import type { MediaStatus, NextAiring } from '@/lib/anilist'
import { formatCountdown, useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: MediaStatus | null; className?: string }) {
  if (status === 'NOT_YET_RELEASED') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full bg-upcoming px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-background shadow',
          className,
        )}
      >
        Upcoming
      </span>
    )
  }
  if (status === 'RELEASING') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-airing px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-background shadow',
          className,
        )}
      >
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-background/70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-background" />
        </span>
        Airing
      </span>
    )
  }
  return null
}

export function AiringCountdown({
  next,
  className,
  compact = false,
}: {
  next: NextAiring
  className?: string
  compact?: boolean
}) {
  const now = useNow()
  if (!next) return null
  const remaining = now ? next.airingAt - Math.floor(now / 1000) : next.timeUntilAiring
  return (
    <span className={cn('font-mono tabular-nums', className)} aria-live="off">
      {compact ? `Ep ${next.episode} · ` : `Episode ${next.episode} in `}
      {formatCountdown(remaining)}
    </span>
  )
}
