'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Download, ListPlus, Pencil, RefreshCw, Star, Trash2, Tv } from 'lucide-react'
import { COMMUNITY_ACTIVITY_QUERY, displayTitle, type ListActivity } from '@/lib/anilist'
import { clearActivityLog, useActivityLog, type ActivityEntry, type ActivityType } from '@/lib/activity'
import { dayLabel, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

const TABS = [
  { value: 'community', label: 'Community Activity' },
  { value: 'mine', label: 'My Activity' },
] as const

export function ActivityView() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('community')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">What the AniList community is watching, and your own history.</p>
      </div>
      <div role="tablist" aria-label="Activity feeds" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => setTab(t.value)}
            className={cn(
              'h-8 rounded-md px-3.5 text-sm font-medium transition-colors',
              tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'community' ? <CommunityFeed /> : <MyFeed />}
      </div>
    </div>
  )
}

type CommunityResponse = { Page: { activities: (ListActivity | Record<string, never>)[] } }

function CommunityFeed() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<CommunityResponse>(
    [COMMUNITY_ACTIVITY_QUERY, { page: 1 }],
    { refreshInterval: 60_000 },
  )
  const items = (data?.Page.activities ?? []).filter(
    (a): a is ListActivity => 'id' in a && !!a.media && !!a.user,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live public list updates · refreshes every minute</p>
        <button
          type="button"
          onClick={() => mutate()}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
        >
          <RefreshCw className={cn('size-3.5', isValidating && 'animate-spin')} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {error && !data ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </p>
      ) : isLoading ? (
        <FeedSkeleton />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <img
                src={a.user!.avatar.medium || '/placeholder.svg'}
                alt=""
                className="size-9 shrink-0 rounded-full bg-muted object-cover"
                loading="lazy"
              />
              <p className="min-w-0 flex-1 text-sm leading-relaxed">
                <span className="font-semibold">{a.user!.name}</span>{' '}
                <span className="text-muted-foreground">
                  {capitalizeStatus(a.status)}
                  {a.progress ? ` ${a.progress} of` : ''}
                </span>{' '}
                <Link href={`/anime/${a.media!.id}`} className="font-medium text-primary hover:underline">
                  {displayTitle(a.media!.title)}
                </Link>
                <span className="mt-0.5 block text-xs text-muted-foreground">{timeAgo(a.createdAt * 1000)}</span>
              </p>
              <Link href={`/anime/${a.media!.id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                <img
                  src={a.media!.coverImage.medium || '/placeholder.svg'}
                  alt=""
                  className="h-14 w-10 rounded object-cover"
                  loading="lazy"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function capitalizeStatus(s: string | null) {
  return s ?? 'updated'
}

const ICONS: Record<ActivityType, typeof Tv> = {
  ADDED: ListPlus,
  PROGRESS: Tv,
  STATUS: Pencil,
  SCORE: Star,
  REMOVED: Trash2,
  IMPORTED: Download,
}

const ICON_TONE: Record<ActivityType, string> = {
  ADDED: 'bg-primary/15 text-primary',
  PROGRESS: 'bg-airing/15 text-airing',
  STATUS: 'bg-accent text-foreground',
  SCORE: 'bg-upcoming/15 text-upcoming',
  REMOVED: 'bg-destructive/15 text-destructive',
  IMPORTED: 'bg-accent text-foreground',
}

function MyFeed() {
  const log = useActivityLog()

  if (log.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing logged yet. Add a show, mark an episode, or rate something and it will appear here.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
          Browse anime
        </Link>
      </div>
    )
  }

  const groups: { label: string; items: ActivityEntry[] }[] = []
  for (const item of log) {
    const label = dayLabel(item.at)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{log.length} events stored on this device</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear your activity history? Your watchlist is not affected.')) clearActivityLog()
          }}
          className="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        >
          Clear history
        </button>
      </div>
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</h2>
          <ol className="flex flex-col gap-2">
            {g.items.map((item) => {
              const Icon = ICONS[item.type]
              const body = (
                <>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', ICON_TONE[item.type])}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <time
                    dateTime={new Date(item.at).toISOString()}
                    className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(item.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </>
              )
              return (
                <li key={item.id}>
                  {item.mediaId ? (
                    <Link
                      href={`/anime/${item.mediaId}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}
