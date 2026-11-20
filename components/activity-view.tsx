'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Activity as ActivityIcon,
  Download,
  Heart,
  ListPlus,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
  Tv,
  Users,
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
  { value: 'community', label: 'Community Feed', icon: Users },
  { value: 'mine', label: 'My History', icon: ActivityIcon },
] as const

export function ActivityView() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('community')

  return (
    <div className="flex flex-col gap-6">
      {/* Editorial Activity Command Header */}
      <div className="glass-panel flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1.5 rounded-full active-pill" aria-hidden="true" />
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Activity Stream</h1>
          </div>
          <p className="text-xs font-medium text-slate-400 sm:text-sm">
            Live AniList community updates and your personal watch history.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Activity feeds"
          className="flex w-fit gap-1 rounded-full border border-white/12 bg-[#0E1015]/85 p-1"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.value
            return (
              <button
                key={t.value}
                id={`tab-${t.value}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.value}`}
                onClick={() => setTab(t.value)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition-all',
                  active ? 'active-pill' : 'text-slate-400 hover:text-white',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {t.label}
              </button>
            )
          })}
        </div>
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <span className="size-2 rounded-full bg-airing animate-pulse" aria-hidden="true" />
          Live public list updates · refreshes every minute
        </span>
        <button
          type="button"
          onClick={() => mutate()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 bg-[#161922]/85 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:border-primary/45 hover:text-primary"
        >
          <RefreshCw className={cn('size-3.5', isValidating && 'animate-spin')} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && !data ? (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </p>
      ) : isLoading ? (
        <FeedSkeleton />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
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
              <li
                key={a.id}
                className="glass-card flex items-center gap-3.5 rounded-3xl border-white/10 p-3.5"
              >
                <Link href={userHref} className="shrink-0">
                  <img
                    src={a.user!.avatar.medium || '/placeholder.svg'}
                    alt={a.user!.name}
                    className="size-10 rounded-full border border-primary/35 bg-muted object-cover transition-transform hover:scale-105"
                    loading="lazy"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-slate-200 sm:text-sm">
                    <Link href={userHref} className="font-extrabold text-white hover:text-primary">
                      {a.user!.name}
                    </Link>{' '}
                    <span className="text-slate-400">
                      {capitalizeStatus(a.status)}
                      {a.progress ? ` ${a.progress} of` : ''}
                    </span>{' '}
                    <Link
                      href={`/anime/${a.media!.id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {displayTitle(a.media!.title)}
                    </Link>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      {timeAgo(a.createdAt * 1000)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleCommunityLike(a)}
                      disabled={Boolean(pendingIds[a.id])}
                      aria-pressed={isLiked}
                      aria-label={isLiked ? 'Unlike activity' : 'Like activity'}
                      title={getStoredAniListToken() ? 'Like on AniList' : 'Like (saved locally)'}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition-all',
                        isLiked
                          ? 'active-pill'
                          : 'border border-white/10 bg-[#0E1015]/75 text-slate-300 hover:border-primary/45 hover:text-white',
                      )}
                    >
                      <Heart className={cn('size-3', isLiked && 'fill-current')} aria-hidden="true" />
                      {displayCount > 0 && <span className="tabular-nums">{displayCount}</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDrawerActivity(a)}
                      aria-label="Open replies"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition-all',
                        replyCount > 0
                          ? 'amber-pill'
                          : 'border border-white/10 bg-[#0E1015]/75 text-slate-300 hover:border-primary/45 hover:text-white',
                      )}
                    >
                      <MessageCircle className="size-3" aria-hidden="true" />
                      <span className="tabular-nums">{replyCount > 0 ? replyCount : 'Reply'}</span>
                    </button>
                  </div>
                </div>

                <Link
                  href={`/anime/${a.media!.id}`}
                  className="shrink-0 overflow-hidden rounded-xl border border-white/10"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={a.media!.coverImage.medium || '/placeholder.svg'}
                    alt=""
                    className="h-16 w-11 object-cover transition-transform duration-300 hover:scale-105"
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
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0E1015] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161922]/85 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full active-pill" aria-hidden="true" />
            <MessageCircle className="size-4 text-primary" />
            <h2 className="text-sm font-extrabold text-white">
              Replies {replies.length > 0 ? `(${replies.length})` : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close replies"
            className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-[#0E1015] text-slate-300 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Original Activity Context */}
        {activity.user && activity.media && (
          <div className="flex items-center gap-3 border-b border-white/10 bg-[#161922]/50 p-4">
            <Link href={`/user/${encodeURIComponent(activity.user.name)}`} onClick={onClose} className="shrink-0">
              <img
                src={activity.user.avatar.medium || '/placeholder.svg'}
                alt={activity.user.name}
                className="size-10 rounded-full border border-primary/35 bg-muted object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <Link
                href={`/user/${encodeURIComponent(activity.user.name)}`}
                onClick={onClose}
                className="font-extrabold text-white hover:text-primary"
              >
                {activity.user.name}
              </Link>{' '}
              <span className="text-slate-400">
                {capitalizeStatus(activity.status)}
                {activity.progress ? ` ${activity.progress} of` : ''}
              </span>{' '}
              <Link
                href={`/anime/${activity.media.id}`}
                onClick={onClose}
                className="font-bold text-primary hover:underline"
              >
                {displayTitle(activity.media.title)}
              </Link>
              <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(activity.createdAt * 1000)}</p>
            </div>
          </div>
        )}

        {/* Replies Thread */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error.message}
            </p>
          ) : replies.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <MessageCircle className="size-7 text-slate-600" />
              <p className="mt-2 text-xs text-slate-400">No replies yet. Start the conversation!</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {replies.map((r) => (
                <li key={r.id} className="glass-panel flex gap-2.5 rounded-2xl p-3">
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
                          className="truncate text-xs font-extrabold text-white hover:text-primary"
                        >
                          {r.user.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-bold text-white">AniList User</span>
                      )}
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {timeAgo(r.createdAt * 1000)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-200">
                      {r.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose Footer */}
        <div className="border-t border-white/10 bg-[#161922]/90 p-3.5">
          {submitError && <p className="mb-2 text-xs text-destructive">{submitError}</p>}
          {token ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply on AniList..."
                maxLength={1000}
                className="h-10 flex-1 rounded-full border border-white/12 bg-[#0E1015] px-4 text-xs text-white placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || submitting}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold active-pill transition-transform hover:scale-105 disabled:opacity-40"
              >
                <Send className="size-3.5" />
                {submitting ? 'Sending' : 'Send'}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400">
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
  ADDED: 'bg-[#FF6B4A]/20 text-primary',
  PROGRESS: 'bg-airing/20 text-airing',
  STATUS: 'bg-white/10 text-white',
  SCORE: 'bg-[#FFB84D]/20 text-upcoming',
  REMOVED: 'bg-destructive/20 text-destructive',
  IMPORTED: 'bg-white/10 text-white',
}

function MyFeed() {
  const log = useActivityLog()
  const { likedIds, toggleLocalLike } = useLocalLikes()

  if (log.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center">
        <p className="text-sm text-slate-300">
          Nothing logged yet. Add a show, mark an episode, or rate something and it will appear here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-xs font-extrabold active-pill"
        >
          <Sparkles className="size-3.5" /> Browse Anime
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
        <p className="text-xs font-semibold text-slate-400">{log.length} events stored on this device</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear your activity history? Your watchlist is not affected.')) clearActivityLog()
          }}
          className="rounded-full border border-white/10 bg-[#161922]/85 px-3.5 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive"
        >
          Clear History
        </button>
      </div>

      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full active-pill" aria-hidden="true" />
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">{g.label}</h2>
          </div>
          <ol className="flex flex-col gap-2.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.type]
              const isLiked = Boolean(likedIds[`mine:${item.id}`])
              const info = (
                <>
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-2xl',
                      ICON_TONE[item.type],
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-white">{item.title}</span>
                    <span className="text-xs font-medium text-slate-400">{item.detail}</span>
                  </span>
                </>
              )
              return (
                <li
                  key={item.id}
                  className="glass-card flex items-center gap-3 rounded-2xl p-3"
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
                    className="shrink-0 font-mono text-xs font-semibold text-slate-400 tabular-nums"
                  >
                    {new Date(item.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </time>
                  <button
                    type="button"
                    onClick={() => toggleLocalLike(`mine:${item.id}`)}
                    aria-pressed={isLiked}
                    aria-label={isLiked ? 'Unlike event' : 'Like event'}
                    className={cn(
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-all',
                      isLiked
                        ? 'active-pill'
                        : 'border border-white/10 bg-[#0E1015]/75 text-slate-300 hover:border-primary/45 hover:text-white',
                    )}
                  >
                    <Heart className={cn('size-3.5', isLiked && 'fill-current')} aria-hidden="true" />
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
    <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl border border-white/10 bg-[#161922]/70" />
      ))}
    </div>
  )
}
