'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  ExternalLink,
  Film,
  Heart,
  Link2,
  Sparkles,
  Star,
  Tv,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  anilist,
  USER_PROFILE_QUERY,
  displayTitle,
  type ListActivity,
  type UserProfile,
} from '@/lib/anilist'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ConnectAniListButton } from '@/components/connect-anilist'

const USER_SOCIAL_QUERY = `
  query UserSocial($id: Int) {
    User(id: $id) {
      id
      isFollowing
      isFollower
    }
    followers: Page(page: 1, perPage: 1) {
      pageInfo {
        total
      }
      followers(userId: $id) {
        id
      }
    }
    following: Page(page: 1, perPage: 1) {
      pageInfo {
        total
      }
      following(userId: $id) {
        id
      }
    }
  }
`

const VIEWER_ID_QUERY = `
  query ViewerIdentity {
    Viewer {
      id
    }
  }
`

const TOGGLE_FOLLOW_MUTATION = `
  mutation ToggleUserFollow($userId: Int!) {
    ToggleFollow(userId: $userId) {
      id
      name
      isFollowing
    }
  }
`

const USER_ACTIVITY_QUERY = `
  query UserActivity($userId: Int) {
    Page(page: 1, perPage: 15) {
      activities(userId: $userId, type: ANIME_LIST, sort: ID_DESC) {
        ... on ListActivity {
          id
          status
          progress
          createdAt
          likeCount
          media { id title { romaji english } coverImage { medium } format }
        }
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

type SocialResponse = {
  User?: { id: number; isFollowing?: boolean; isFollower?: boolean }
  followers?: { pageInfo?: { total?: number } }
  following?: { pageInfo?: { total?: number } }
}

export default function UserProfilePage() {
  const params = useParams<{ name: string }>()
  const userName = decodeURIComponent(params?.name ?? '')

  const { data, error, isLoading } = useSWR<{ User: UserProfile }>(
    userName ? [USER_PROFILE_QUERY, { name: userName }] : null,
  )
  const user = data?.User

  const { data: actData } = useSWR<{ Page: { activities: ListActivity[] } }>(
    user?.id ? [USER_ACTIVITY_QUERY, { userId: user.id }] : null,
  )

  const [token, setToken] = useState<string | null>(null)
  const [viewerId, setViewerId] = useState<number | null>(null)
  const [remoteFollowing, setRemoteFollowing] = useState<boolean>(false)
  const [isFollower, setIsFollower] = useState<boolean>(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)
  const [followBusy, setFollowBusy] = useState(false)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  useEffect(() => {
    const syncToken = () => setToken(getStoredAniListToken())
    syncToken()
    window.addEventListener('storage', syncToken)
    window.addEventListener('focus', syncToken)
    return () => {
      window.removeEventListener('storage', syncToken)
      window.removeEventListener('focus', syncToken)
    }
  }, [])

  // Fetch viewer ID when synced so we don't show a Follow button on your own profile
  useEffect(() => {
    if (!token) {
      setViewerId(null)
      return
    }
    let active = true
    anilist<{ Viewer?: { id: number } }>(VIEWER_ID_QUERY, {}, token)
      .then((res) => {
        if (active && res?.Viewer?.id) setViewerId(res.Viewer.id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [token])

  // Fetch public follower/following totals + authenticated follow relationship
  useEffect(() => {
    if (!user?.id) return
    let active = true
    anilist<SocialResponse>(USER_SOCIAL_QUERY, { id: user.id }, token ?? undefined)
      .then((res) => {
        if (!active) return
        if (typeof res?.followers?.pageInfo?.total === 'number') {
          setFollowerCount(res.followers.pageInfo.total)
        }
        if (typeof res?.following?.pageInfo?.total === 'number') {
          setFollowingCount(res.following.pageInfo.total)
        }
        if (typeof res?.User?.isFollowing === 'boolean') {
          setRemoteFollowing(res.User.isFollowing)
        } else {
          setRemoteFollowing(false)
        }
        if (typeof res?.User?.isFollower === 'boolean') {
          setIsFollower(res.User.isFollower)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user?.id, token])

  const handleToggleFollow = async () => {
    if (!user || followBusy) return

    const latestToken = getStoredAniListToken()
    if (!latestToken) {
      setToken(null)
      setSyncNotice('Sync your AniList account first to follow users.')
      return
    }

    setSyncNotice(null)
    const prevFollowing = remoteFollowing
    const nextFollowing = !prevFollowing
    const prevFollowers = followerCount

    setFollowBusy(true)
    setRemoteFollowing(nextFollowing)
    if (prevFollowers !== null) {
      setFollowerCount(Math.max(0, prevFollowers + (nextFollowing ? 1 : -1)))
    }

    try {
      const res = await anilist<{ ToggleFollow?: { id: number; isFollowing: boolean } }>(
        TOGGLE_FOLLOW_MUTATION,
        { userId: user.id },
        latestToken,
      )
      if (res?.ToggleFollow && typeof res.ToggleFollow.isFollowing === 'boolean') {
        const confirmed = res.ToggleFollow.isFollowing
        setRemoteFollowing(confirmed)
        if (prevFollowers !== null && confirmed !== nextFollowing) {
          setFollowerCount(Math.max(0, prevFollowers + (confirmed ? 1 : -1)))
        }
      }
    } catch {
      setRemoteFollowing(prevFollowing)
      if (prevFollowers !== null) setFollowerCount(prevFollowers)
      setSyncNotice('Could not update follow status on AniList. Please check your connection.')
    } finally {
      setFollowBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-56 animate-pulse rounded-3xl border border-white/10 bg-[#161922]/70" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl border border-white/10 bg-[#161922]/70" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/activity"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/12 bg-[#161922]/85 px-4 py-1.5 text-xs font-bold text-slate-300 hover:border-primary/45 hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Back to Activity
        </Link>
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || `Could not load profile for "${userName}".`}
        </p>
      </div>
    )
  }

  const stats = user.statistics.anime
  const hoursWatched = Math.round(stats.minutesWatched / 60)
  const daysWatched = (stats.minutesWatched / 1440).toFixed(1)
  const isOwnProfile = viewerId !== null && viewerId === user.id

  return (
    <div className="flex flex-col gap-8">
      {/* Top Floating Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#161922]/85 px-4 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-primary/45 hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Back to Activity
        </Link>
        {user.siteUrl && (
          <a
            href={user.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#161922]/85 px-4 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-primary/45 hover:text-primary"
          >
            AniList Profile <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* Editorial Gallery Banner & Avatar Card */}
      <div className="glass-panel overflow-hidden rounded-3xl">
        <div className="relative h-40 w-full bg-gradient-to-r from-[#FF6B4A]/25 via-[#161922] to-[#FFB84D]/15 md:h-52">
          {user.bannerImage && (
            <img src={user.bannerImage} alt="" className="size-full object-cover opacity-80" />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1015] via-[#0E1015]/30 to-transparent"
          />
        </div>

        <div className="relative flex flex-col gap-5 px-5 pb-6 pt-14 sm:flex-row sm:items-end sm:justify-between sm:pt-5 md:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <img
              src={user.avatar.large || user.avatar.medium || '/placeholder.svg'}
              alt={user.name}
              className="absolute -top-12 left-5 size-24 rounded-3xl border-2 border-[#FF6B4A]/60 bg-muted object-cover shadow-2xl sm:static sm:-mt-16 sm:size-28"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{user.name}</h1>
                {isFollower && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold amber-pill">
                    Follows you
                  </span>
                )}
              </div>

              {/* Follower & Following Counts */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0E1015]/75 px-3 py-1">
                  <Users className="size-3.5 text-primary" aria-hidden="true" />
                  <strong className="font-extrabold text-white tabular-nums">
                    {followerCount !== null ? followerCount.toLocaleString() : '—'}
                  </strong>{' '}
                  <span className="text-slate-400">Followers</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0E1015]/75 px-3 py-1">
                  <strong className="font-extrabold text-white tabular-nums">
                    {followingCount !== null ? followingCount.toLocaleString() : '—'}
                  </strong>{' '}
                  <span className="text-slate-400">Following</span>
                </span>
              </div>

              {user.about ? (
                <p className="mt-2.5 line-clamp-3 max-w-2xl whitespace-pre-line text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {user.about}
                </p>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-400">AniList Community Member</p>
              )}
            </div>
          </div>

          {/* Follow Action (Requires Synced AniList Account) */}
          {!isOwnProfile && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              {token ? (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                  aria-pressed={remoteFollowing}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-extrabold transition-all hover:scale-[1.02] disabled:opacity-60',
                    remoteFollowing
                      ? 'border border-[#FF6B4A]/50 bg-[#FF6B4A]/15 text-[#FF8E53]'
                      : 'active-pill',
                  )}
                >
                  {remoteFollowing ? (
                    <>
                      <UserCheck className="size-4" aria-hidden="true" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" aria-hidden="true" />
                      Follow
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncNotice('Sync your AniList account to follow users.')}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-[#0E1015]/80 px-4 text-xs font-bold text-slate-400 transition-colors hover:border-primary/40 hover:text-slate-200"
                    title="Sync your AniList account to follow users"
                  >
                    <Link2 className="size-3.5 text-primary" aria-hidden="true" />
                    Sync AniList to Follow
                  </button>
                  <ConnectAniListButton variant="inline" />
                </div>
              )}
              {syncNotice && (
                <p role="status" className="text-[11px] font-semibold text-upcoming">
                  {syncNotice}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4 Editorial Bento KPI Cards */}
      <div className="bento-stat grid grid-cols-2 overflow-hidden rounded-3xl md:grid-cols-4">
        <div className="border-b border-r border-white/10 p-4 md:border-b-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Film className="size-4 text-primary" /> Total Anime
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{stats.count.toLocaleString()}</p>
        </div>
        <div className="border-b border-white/10 p-4 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Tv className="size-4 text-primary" /> Episodes Watched
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">
            {stats.episodesWatched.toLocaleString()}
          </p>
        </div>
        <div className="border-r border-white/10 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Sparkles className="size-4 text-upcoming" /> Watch Time
          </div>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{daysWatched}d</p>
          <p className="text-xs font-medium text-slate-400">{hoursWatched.toLocaleString()} hours</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Star className="size-4 text-upcoming" /> Mean Score
          </div>
          <p className="mt-2 text-2xl font-black text-upcoming tabular-nums">
            {stats.meanScore ? `${stats.meanScore}%` : '—'}
          </p>
        </div>
      </div>

      {/* Top Genres */}
      {stats.genres.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
              Top Genres
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.genres.map((g) => (
              <span
                key={g.genre}
                className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <span>{g.genre}</span>
                <span className="rounded-full px-2 py-0.2 text-[10px] font-extrabold active-pill tabular-nums">
                  {g.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Favorite Anime */}
      {user.favourites.anime.nodes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
              Favorite Anime
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {user.favourites.anime.nodes.map((anime) => (
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                className="glass-card group flex flex-col gap-2 rounded-3xl border-[#FF6B4A]/30 p-2.5"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={anime.coverImage.large || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <p className="line-clamp-1 px-1 text-xs font-bold text-white group-hover:text-primary">
                  {displayTitle(anime.title)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Favorite Characters */}
      {user.favourites.characters.nodes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
              Favorite Characters
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {user.favourites.characters.nodes.map((char) => (
              <Link
                key={char.id}
                href={`/character/${char.id}`}
                className="glass-card group flex flex-col gap-2 rounded-3xl border-white/10 p-2.5"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={char.image.large || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <p className="line-clamp-1 px-1 text-xs font-bold text-white group-hover:text-primary">
                  {char.name.full}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent User Activity */}
      {(actData?.Page.activities ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
              Recent Updates
            </h2>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {actData!.Page.activities
              .filter((a) => a.media)
              .map((a) => (
                <li
                  key={a.id}
                  className="glass-card flex items-center gap-3.5 rounded-3xl border-white/10 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-slate-200 sm:text-sm">
                      <span className="capitalize text-slate-400">
                        {a.status ?? 'updated'}
                        {a.progress ? ` ${a.progress} of` : ''}
                      </span>{' '}
                      <Link
                        href={`/anime/${a.media!.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {displayTitle(a.media!.title)}
                      </Link>
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span>{timeAgo(a.createdAt * 1000)}</span>
                      {a.likeCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-extrabold active-pill">
                          <Heart className="size-2.5 fill-current" /> {a.likeCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/anime/${a.media!.id}`}
                    className="shrink-0 overflow-hidden rounded-xl border border-white/10"
                  >
                    <img
                      src={a.media!.coverImage.medium || '/placeholder.svg'}
                      alt=""
                      className="h-16 w-11 object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
