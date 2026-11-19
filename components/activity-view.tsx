'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Download, Heart, ListPlus, Pencil, RefreshCw, Star, Trash2, Tv } from 'lucide-react'
import { COMMUNITY_ACTIVITY_QUERY, displayTitle, type ListActivity } from '@/lib/anilist'
import { clearActivityLog, useActivityLog, type ActivityEntry, type ActivityType } from '@/lib/activity'
import { dayLabel, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

const LOCAL_LIKES_KEY = 'anideck_activity_likes_v1'

const TOGGLE_LIKE_MUTATION = `
  mutation ToggleActivityLike($id: Int!) {
    ToggleLikeV2(id: $id, type: ACTIVITY) {
      ... on ListActivity {
        id
        likeCount
        isLiked
      }
      ... on TextActivity {
        id
        likeCount
        isLiked
      }
    }
  }
`

function getStoredAniListToken(): string | null {
  if (typeof window === 'undefined') return null
  const directKeys = ['anilist_token', 'anilist_access_token', 'anideck_anilist_token']
  for (const key of directKeys) {
    const val = window.localStorage.getItem(key)
    if (val && val.length > 20) return val.replace(/^"|"$/g, '')
  }
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    if (raw.startsWith('{') && raw.includes('token')) {
      try {
        const parsed = JSON.parse(raw)
        const token = parsed?.token || parsed?.accessToken || parsed?.access_token
        if (typeof token === 'string' && token.length > 20) return token
      } catch {
        // ignore invalid JSON
      }
    }
  }
  return null
}

function useLocalLikes() {
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_LIKES_KEY)
      if (saved) setLikedIds(JSON.parse(saved))
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggleLocalLike = (key: string) => {
    setLikedIds((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      try {
        window.localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  return { likedIds, toggleLocalLike }
}

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

type CommunityActivityItem = ListActivity & {
  likeCount?: number
  isLiked?: boolean
}

type CommunityResponse = { Page: { activities: (CommunityActivityItem | Record<string, never>)[] } }

function CommunityFeed() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<CommunityResponse>(
    [COMMUNITY_ACTIVITY_QUERY, { page: 1 }],
    { refreshInterval: 60_000 },
  )
  const { likedIds, toggleLocalLike } = useLocalLikes()
  const [remoteOverrides, setRemoteOverrides] = useState<Record<number, { isLiked: boolean; likeCount: number }>>({})
  const [pendingIds, setPendingIds] = useState<Record<number, boolean>>({})

  const items = (data?.Page.activities ?? []).filter(
    (a): a is CommunityActivityItem => 'id' in a && !!a.media && !!a.user,
  )

  const handleToggleCommunityLike = async (activity: CommunityActivityItem) => {
    if (pendingIds[activity.id]) return
    const token = getStoredAniListToken()
    const baseCount = activity.likeCount ?? 0
    const localKey = `community:${activity.id}`

    if (!token) {
      toggleLocalLike(localKey)
      return
    }

    const currentLiked = remoteOverrides[activity.id]?.isLiked ?? Boolean(activity.isLiked)
    const currentCount = remoteOverrides[activity.id]?.likeCount ?? baseCount
    const optimisticLiked = !currentLiked
    const optimisticCount = Math.max(0, currentCount + (optimisticLiked ? 1 : -1))

    setPendingIds((prev) => ({ ...prev, [activity.id]: true }))
    setRemoteOverrides((prev) => ({
      ...prev,
      [activity.id]: { isLiked: optimisticLiked, likeCount: optimisticCount },
    }))

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: TOGGLE_LIKE_MUTATION,
          variables: { id: activity.id },
        }),
      })
      const json = await res.json()
      const updated = json?.data?.ToggleLikeV2
      if (updated && typeof updated.isLiked === 'boolean') {
        setRemoteOverrides((prev) => ({
          ...prev,
          [activity.id]: {
            isLiked: updated.isLiked,
            likeCount: typeof updated.likeCount === 'number' ? updated.likeCount : optimisticCount,
          },
        }))
      }
    } catch {
      // Revert optimistic state on network failure
      setRemoteOverrides((prev) => ({
        ...prev,
        [activity.id]: { isLiked: currentLiked, likeCount: currentCount },
      }))
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev }
        delete next[activity.id]
        return next
      })
    }
  }

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
          {items.map((a) => {
            const override = remoteOverrides[a.id]
            const isLocalLiked = Boolean(likedIds[`community:${a.id}`])
            const isLiked = override ? override.isLiked : Boolean(a.isLiked) || isLocalLiked
            const displayCount = override
              ? override.likeCount
              : (a.likeCount ?? 0) + (!a.isLiked && isLocalLiked ? 1 : 0)

            return (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <img
                  src={a.user!.avatar.medium || '/placeholder.svg'}
                  alt=""
                  className="size-9 shrink-0 rounded-full bg-muted object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold">{a.user!.name}</span>{' '}
                    <span className="text-muted-foreground">
                      {capitalizeStatus(a.status)}
                      {a.progress ? ` ${a.progress} of` : ''}
                    </span>{' '}
                    <Link href={`/anime/${a.media!.id}`} className="font-medium text-primary hover:underline">
                      {displayTitle(a.media!.title)}
                    </Link>
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt * 1000)}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCommunityLike(a)}
                      disabled={Boolean(pendingIds[a.id])}
                      aria-pressed={isLiked}
                      aria-label={isLiked ? 'Unlike activity' : 'Like activity'}
                      title={getStoredAniListToken() ? 'Like on AniList' : 'Like (saved locally)'}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                        isLiked
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <Heart className={cn('size-3', isLiked && 'fill-primary text-primary')} aria-hidden="true" />
                      {displayCount > 0 && <span className="tabular-nums">{displayCount}</span>}
                    </button>
                  </div>
                </div>
                <Link href={`/anime/${a.media!.id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                  <img
                    src={a.media!.coverImage.medium || '/placeholder.svg'}
                    alt=""
                    className="h-14 w-10 rounded object-cover"
                    loading="lazy"
                  />
                </Link>
              </li>
            )
          })}
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
  const { likedIds, toggleLocalLike } = useLocalLikes()

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
              const isLiked = Boolean(likedIds[`mine:${item.id}`])
              const info = (
                <>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', ICON_TONE[item.type])}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                </>
              )
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/50"
                >
                  {item.mediaId ? (
                    <Link href={`/anime/${item.mediaId}`} className="flex min-w-0 flex-1 items-center gap-3">
                      {info}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">{info}</div>
                  )}
                  <time
                    dateTime={new Date(item.at).toISOString()}
                    className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(item.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </time>
                  <button
                    type="button"
                    onClick={() => toggleLocalLike(`mine:${item.id}`)}
                    aria-pressed={isLiked}
                    aria-label={isLiked ? 'Unlike event' : 'Like event'}
                    className={cn(
                      'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                      isLiked
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    <Heart className={cn('size-3.5', isLiked && 'fill-primary text-primary')} aria-hidden="true" />
                  </button>
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
