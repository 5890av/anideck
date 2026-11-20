'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ListChecks, Sparkles } from 'lucide-react'
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
  const [selectedDay, setSelectedDay] = useState<string>('ALL')
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

  const allBuckets = days.length ? days : DAY_NAMES.map((name) => ({ name, date: null, items: [] }))
  const visibleDays = selectedDay === 'ALL' ? allBuckets : allBuckets.filter((d) => d.name === selectedDay)

  return (
    <div className="flex flex-col gap-6">
      {/* Editorial Broadcast Header */}
      <div className="glass-panel flex flex-col gap-5 rounded-3xl p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-6 w-1.5 rounded-full active-pill" aria-hidden="true" />
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                Broadcast Schedule
              </h1>
              {!isLoading && (
                <span className="rounded-full px-3 py-0.5 text-xs font-extrabold amber-pill">
                  {total} Episodes
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400 sm:text-sm">
              <CalendarIcon className="size-3.5 text-primary" aria-hidden="true" />
              {weekStart
                ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
                    weekStart.getFullYear(),
                    weekStart.getMonth(),
                    weekStart.getDate() + 6,
                  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Loading week…'}
              {timeZone && ` • ${timeZone}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* My Watchlist Pill Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={onlyWatchlist}
              onClick={() => setOnlyWatchlist((v) => !v)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-extrabold transition-all',
                onlyWatchlist
                  ? 'active-pill'
                  : 'border border-white/12 bg-[#0E1015]/80 text-slate-300 hover:border-primary/45 hover:text-white',
              )}
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              <span>My Watchlist</span>
              <span
                className={cn(
                  'relative h-4 w-7 rounded-full transition-colors',
                  onlyWatchlist ? 'bg-black/30' : 'bg-white/15',
                )}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-3 rounded-full bg-white transition-all',
                    onlyWatchlist ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
            </button>

            {/* Week Switcher Pill Dock */}
            <div className="flex items-center rounded-full border border-white/12 bg-[#0E1015]/85 p-1">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="flex size-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className="h-8 px-3 text-xs font-extrabold text-white transition-colors hover:text-primary disabled:text-primary"
              >
                {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="flex size-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Day Filter Pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setSelectedDay('ALL')}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all',
              selectedDay === 'ALL'
                ? 'active-pill'
                : 'border border-white/10 bg-[#0E1015]/75 text-slate-300 hover:border-primary/45 hover:text-white',
            )}
          >
            Full Week ({total})
          </button>
          {allBuckets.map((day) => {
            const isToday = day.date?.toDateString() === todayKey
            const active = selectedDay === day.name
            return (
              <button
                key={day.name}
                type="button"
                onClick={() => setSelectedDay(active ? 'ALL' : day.name)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                  active
                    ? 'active-pill'
                    : isToday
                      ? 'border border-[#FFB84D]/50 bg-[#FFB84D]/15 text-upcoming hover:bg-[#FFB84D]/25'
                      : 'border border-white/10 bg-[#0E1015]/75 text-slate-300 hover:border-primary/45 hover:text-white',
                )}
              >
                <span>{day.name.slice(0, 3)}</span>
                {day.date && (
                  <span className="opacity-75">{day.date.getDate()}</span>
                )}
                {day.items.length > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-extrabold',
                      active ? 'bg-black/25 text-white' : 'bg-white/10 text-slate-200',
                    )}
                  >
                    {day.items.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {onlyWatchlist && !isLoading && data && total === 0 && (
        <div className="glass-panel rounded-3xl p-8 text-center text-sm text-slate-300">
          None of the shows in your watchlist air this week.{' '}
          <Link href="/" className="font-bold text-primary hover:underline">
            Explore trending shows
          </Link>
          .
        </div>
      )}

      {/* Editorial Broadcast Columns / Grid */}
      <div
        className={cn(
          'grid gap-4',
          selectedDay === 'ALL'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid-cols-1',
        )}
      >
        {visibleDays.map((day) => {
          const isToday = day.date?.toDateString() === todayKey
          return (
            <section
              key={day.name}
              aria-label={day.name}
              className={cn(
                'glass-panel flex flex-col gap-3.5 rounded-3xl p-4',
                isToday && 'border-[#FF6B4A]/50 shadow-[0_0_28px_-8px_rgba(255,107,74,0.35)]',
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-4 w-1 rounded-full',
                      isToday ? 'active-pill' : 'bg-white/25',
                    )}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    {day.name}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {isToday && (
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold active-pill">
                      Today
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-400">
                    {day.date?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </header>

              {isLoading || !day.date ? (
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : day.items.length === 0 ? (
                <p className="py-8 text-center text-xs font-medium text-slate-400">
                  No episodes scheduled
                </p>
              ) : (
                <ul
                  className={cn(
                    'grid gap-2.5',
                    selectedDay !== 'ALL' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
                  )}
                >
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
          'glass-card group flex items-center gap-3 rounded-2xl p-2.5',
          aired && 'opacity-65 hover:opacity-100',
          inWatchlist && 'border-[#FFB84D]/55 bg-[#FFB84D]/[0.06]',
        )}
      >
        {schedule.media.coverImage.large ? (
          <img
            src={schedule.media.coverImage.large || '/placeholder.svg'}
            alt=""
            loading="lazy"
            className="h-16 w-12 shrink-0 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-16 w-12 shrink-0 rounded-xl bg-muted" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="rounded-full px-2 py-0.2 text-[10px] font-extrabold active-pill">
              EP {schedule.episode}
              {total ? `/${total}` : ''}
            </span>
            <time
              dateTime={new Date(schedule.airingAt * 1000).toISOString()}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-300"
            >
              <Clock className="size-2.5 text-primary" aria-hidden="true" />
              {time}
            </time>
          </div>

          <p className="line-clamp-1 text-xs font-bold text-white transition-colors group-hover:text-primary">
            {displayTitle(schedule.media.title)}
          </p>

          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'font-mono text-[10px] font-bold',
                aired ? 'text-slate-400' : 'text-airing',
              )}
            >
              {aired ? 'Aired' : `in ${formatCountdown(schedule.airingAt - nowSec)}`}
            </span>
            {inWatchlist && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-upcoming">
                <Sparkles className="size-2.5" aria-hidden="true" /> Saved
              </span>
            )}
            {!inWatchlist && schedule.media.format && schedule.media.format !== 'TV' && (
              <span className="text-[10px] font-semibold text-slate-400">
                {formatEnum(schedule.media.format)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

