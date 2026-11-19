'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Download,
  Heart,
  ListPlus,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Star,
  Trash2,
  Tv,
  X,
} from 'lucide-react'
import { anilist, COMMUNITY_ACTIVITY_QUERY, displayTitle, type ListActivity } from '@/lib/anilist'
import { clearActivityLog, useActivityLog, type ActivityEntry, type ActivityType } from '@/lib/activity'
import { dayLabel, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

const LOCAL_LIKES_KEY = 'anideck_activity_likes_v1'

const ACTIVITY_WITH_REPLIES_QUERY = `
  query ActivityWithReplies($page: Int) {
    Page(page: $page, perPage: 25) {
      pageInfo { hasNextPage }
      activities(type: ANIME_LIST, sort: ID_DESC) {
        ... on ListActivity {
          id
          status
          progress
          createdAt
          likeCount
          replyCount
          isLiked
          user { id name avatar { medium } }
          media { id title { romaji english } coverImage { medium } format }
        }
      }
    }
  }
`

const ACTIVITY_REPLIES_QUERY = `
  query ActivityReplies($activityId: Int!) {
    Page(page: 1, perPage: 50) {
      activityReplies(activityId: $activityId) {
        id
        text(asHtml: false)
        likeCount
        isLiked
        createdAt
        user {
          id
          name
          avatar { medium }
        }
      }
    }
  }
`

const SAVE_ACTIVITY_REPLY_MUTATION = `
  mutation SaveActivityReply($activityId: Int!, $text: String!) {
    SaveActivityReply(activityId: $activityId, text: $text) {
      id
      text(asHtml: false)
      likeCount
      isLiked
      createdAt
      user {
        id
        name
        avatar { medium }
      }
    }
  }
`

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
  replyCount?: number
  isLiked?: boolean
}

type ActivityReplyItem = {
  id: number
  text: string
  likeCount: number
  isLiked: boolean
  createdAt: number
  user: {
    id: number
    name: string
    avatar: { medium: string | null }
  } | null
}

type CommunityResponse = { Page: { activities: (CommunityActivityItem | Record<string, never>)[] } }

function CommunityFeed() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<CommunityResponse>(
    [ACTIVITY_WITH_REPLIES_QUERY || COMMUNITY_ACTIVITY_QUERY, { page: 1 }],
    { refreshInterval: 60_000 },
  )
  const { likedIds, toggleLocalLike } = useLocalLikes()
  const [remoteOverrides, setRemoteOverrides] = useState<Record<number, { isLiked: boolean; likeCount: number }>>({})
  const [replyCountOverrides, setReplyCountOverrides] = useState<Record<number, number>>({})
  const [pendingIds, setPendingIds] = useState<Record<number, boolean>>({})
  const [activeDrawerActivity, setActiveDrawerActivity] = useState<CommunityActivityItem | null>(null)

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
      const json = await anilist<{ ToggleLikeV2?: { isLiked: boolean; likeCount: number } }>(
        TOGGLE_LIKE_MUTATION,
        { id: activity.id },
        token,
      )
      const updated = json?.ToggleLikeV2
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
            const replyCount = replyCountOverrides[a.id] ?? (a.replyCount ?? 0)
            const userHref = `/user/${encodeURIComponent(a.user!.name)}`

            return (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <Link href={userHref} className="shrink-0">
                  <img
                    src={a.user!.avatar.medium || '/placeholder.svg'}
                    alt={a.user!.name}
                    className="size-9 rounded-full bg-muted object-cover transition-opacity hover:opacity-80"
                    loading="lazy"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    <Link href={userHref} className="font-semibold hover:text-primary hover:underline">
                      {a.user!.name}
                    </Link>{' '}
                    <span className="text-muted-foreground">
                      {capitalizeStatus(a.status)}
                      {a.progress ? ` ${a.progress} of` : ''}
                    </span>{' '}
                    <Link href={`/anime/${a.media!.id}`} className="font-medium text-primary hover:underline">
                      {displayTitle(a.media!.title)}
                    </Link>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
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

                    <button
                      type="button"
                      onClick={() => setActiveDrawerActivity(a)}
                      aria-label="Open replies"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                        replyCount > 0
                          ? 'border-border bg-secondary/80 text-foreground hover:border-primary/40 hover:text-primary'
                          : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <MessageCircle className="size-3" aria-hidden="true" />
                      <span className="tabular-nums">{replyCount > 0 ? replyCount : 'Reply'}</span>
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

      {activeDrawerActivity && (
        <ReplyDrawer
          activity={activeDrawerActivity}
          onClose={() => setActiveDrawerActivity(null)}
          onReplyPosted={(newCount) =>
            setReplyCountOverrides((prev) => ({ ...prev, [activeDrawerActivity.id]: newCount }))
          }
        />
      )}
    </div>
  )
}

function ReplyDrawer({
  activity,
  onClose,
  onReplyPosted,
}: {
  activity: CommunityActivityItem
  onClose: () => void
  onReplyPosted: (count: number) => void
}) {
  const token = getStoredAniListToken()
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR<{ Page: { activityReplies: ActivityReplyItem[] } }>(
    [ACTIVITY_REPLIES_QUERY, { activityId: activity.id }],
  )

  const replies = data?.Page.activityReplies ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = replyText.trim()
    if (!trimmed || !token || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await anilist<{ SaveActivityReply: ActivityReplyItem }>(
        SAVE_ACTIVITY_REPLY_MUTATION,
        { activityId: activity.id, text: trimmed },
        token,
      )
      if (res?.SaveActivityReply) {
        const nextReplies = [...replies, res.SaveActivityReply]
        await mutate({ Page: { activityReplies: nextReplies } }, false)
        onReplyPosted(nextReplies.length)
        setReplyText('')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post reply.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Activity replies"
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">
              Replies {replies.length > 0 ? `(${replies.length})` : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close replies"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Original Activity Context */}
        {activity.user && activity.media && (
          <div className="flex items-center gap-3 border-b border-border bg-card/70 p-4">
            <Link href={`/user/${encodeURIComponent(activity.user.name)}`} onClick={onClose} className="shrink-0">
              <img
                src={activity.user.avatar.medium || '/placeholder.svg'}
                alt={activity.user.name}
                className="size-9 rounded-full bg-muted object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <Link
                href={`/user/${encodeURIComponent(activity.user.name)}`}
                onClick={onClose}
                className="font-semibold hover:text-primary"
              >
                {activity.user.name}
              </Link>{' '}
              <span className="text-muted-foreground">
                {capitalizeStatus(activity.status)}
                {activity.progress ? ` ${activity.progress} of` : ''}
              </span>{' '}
              <Link
                href={`/anime/${activity.media.id}`}
                onClick={onClose}
                className="font-medium text-primary hover:underline"
              >
                {displayTitle(activity.media.title)}
              </Link>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(activity.createdAt * 1000)}</p>
            </div>
          </div>
        )}

        {/* Replies Thread */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error.message}
            </p>
          ) : replies.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <MessageCircle className="size-7 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">No replies yet. Start the conversation!</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {replies.map((r) => (
                <li key={r.id} className="flex gap-2.5 rounded-xl border border-border bg-card p-3">
                  {r.user ? (
                    <Link
                      href={`/user/${encodeURIComponent(r.user.name)}`}
                      onClick={onClose}
                      className="shrink-0"
                    >
                      <img
                        src={r.user.avatar.medium || '/placeholder.svg'}
                        alt={r.user.name}
                        className="size-8 rounded-full bg-muted object-cover"
                      />
                    </Link>
                  ) : (
                    <div className="size-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      {r.user ? (
                        <Link
                          href={`/user/${encodeURIComponent(r.user.name)}`}
                          onClick={onClose}
                          className="truncate text-xs font-semibold hover:text-primary"
                        >
                          {r.user.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold">AniList User</span>
                      )}
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(r.createdAt * 1000)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
                      {r.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose Footer */}
        <div className="border-t border-border bg-card p-3.5">
          {submitError && <p className="mb-2 text-xs text-destructive">{submitError}</p>}
          {token ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply on AniList..."
                maxLength={1000}
                className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="size-3.5" />
                {submitting ? 'Sending' : 'Send'}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Connect AniList in the top bar to post replies.</span>
            </div>
          )}
        </div>
      </div>
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
