'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { displayTitle, fetchWeekAiring, formatEnum, type AiringSchedule } from '@/lib/anilist'
import { formatCountdown, useNow } from '@/lib/use-now'
import { useWatchlist } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function startOfWeek(offset: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const mondayIndex = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayIndex + offset * 7)
  return d
}

const noopSubscribe = () => () => {}

export function CalendarView() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [onlyWatchlist, setOnlyWatchlist] = useState(false)
  const watchlist = useWatchlist()
  const watchIds = useMemo(() => new Set(watchlist.map((e) => e.id)), [watchlist])

  const weekStart = useMemo(() => (isClient ? startOfWeek(weekOffset) : null), [isClient, weekOffset])
  const range = weekStart
    ? {
        start: Math.floor(weekStart.getTime() / 1000) - 1,
        end: Math.floor(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7).getTime() / 1000),
      }
    : null

  const { data, error, isLoading } = useSWR(range ? ['airing-week', range.start, range.end] : null, () =>
    fetchWeekAiring(range!.start, range!.end),
  )

  const days = useMemo(() => {
    if (!weekStart) return []
    const buckets = DAY_NAMES.map((name, i) => {
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
      return { name, date, items: [] as AiringSchedule[] }
    })
    for (const s of data ?? []) {
      if (onlyWatchlist && !watchIds.has(s.media.id)) continue
      const idx = (new Date(s.airingAt * 1000).getDay() + 6) % 7
      buckets[idx].items.push(s)
    }
    return buckets
  }, [data, onlyWatchlist, watchIds, weekStart])

  const todayKey = new Date().toDateString()
  const total = days.reduce((n, d) => n + d.items.length, 0)
  const timeZone = isClient ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Airing calendar</h1>
          <p className="text-sm text-muted-foreground">
            {weekStart
              ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() + 6,
                ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Loading week…'}
            {timeZone && ` · times shown in ${timeZone}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={onlyWatchlist}
            onClick={() => setOnlyWatchlist((v) => !v)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
              onlyWatchlist
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <ListChecks className="size-4" aria-hidden="true" />
            My Watchlist only
            <span
              className={cn(
                'relative h-4 w-7 rounded-full transition-colors',
                onlyWatchlist ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'absolute top-0.5 size-3 rounded-full bg-background transition-all',
                  onlyWatchlist ? 'left-3.5' : 'left-0.5',
                )}
              />
            </span>
          </button>
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="h-9 px-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:text-foreground"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {onlyWatchlist && !isLoading && data && total === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          None of the shows in your watchlist air this week.{' '}
          <Link href="/" className="text-primary hover:underline">
            Find something to watch
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {(days.length ? days : DAY_NAMES.map((name) => ({ name, date: null, items: [] }))).map((day) => {
          const isToday = day.date?.toDateString() === todayKey
          return (
            <section
              key={day.name}
              aria-label={day.name}
              className={cn(
                'flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3',
                isToday && 'border-primary/60 bg-primary/5',
              )}
            >
              <header className="flex items-baseline justify-between gap-2">
                <h2 className={cn('font-semibold', isToday && 'text-primary')}>{day.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {day.date?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {isToday && ' · Today'}
                </span>
              </header>
              {isLoading || !day.date ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : day.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No episodes</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {day.items.map((s) => (
                    <AiringItem key={s.id} schedule={s} inWatchlist={watchIds.has(s.media.id)} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function AiringItem({ schedule, inWatchlist }: { schedule: AiringSchedule; inWatchlist: boolean }) {
  const now = useNow()
  const nowSec = Math.floor((now || Date.now()) / 1000)
  const aired = schedule.airingAt <= nowSec
  const time = new Date(schedule.airingAt * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const total = schedule.media.episodes

  return (
    <li>
      <Link
        href={`/anime/${schedule.media.id}`}
        className={cn(
          'flex gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-accent',
          aired && 'opacity-60 hover:opacity-100',
          inWatchlist && 'ring-1 ring-primary/50',
        )}
      >
        {schedule.media.coverImage.large ? (
          <img src={schedule.media.coverImage.large || "/placeholder.svg"} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-14 w-10 shrink-0 rounded bg-muted" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="line-clamp-2 text-xs font-medium leading-snug">{displayTitle(schedule.media.title)}</p>
          <p className="text-[11px] text-muted-foreground">
            <time dateTime={new Date(schedule.airingAt * 1000).toISOString()} className="font-mono text-foreground">
              {time}
            </time>
            {' · '}Ep {schedule.episode}
            {total ? `/${total}` : ''}
            {schedule.media.format && schedule.media.format !== 'TV' ? ` · ${formatEnum(schedule.media.format)}` : ''}
          </p>
          <p className={cn('font-mono text-[10px]', aired ? 'text-muted-foreground' : 'text-airing')}>
            {aired ? 'Aired' : `in ${formatCountdown(schedule.airingAt - nowSec)}`}
          </p>
        </div>
      </Link>
    </li>
  )
}
