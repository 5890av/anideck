'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, ExternalLink, Film, Heart, Sparkles, Star, Tv } from 'lucide-react'
import {
  COMMUNITY_ACTIVITY_QUERY,
  USER_PROFILE_QUERY,
  displayTitle,
  type ListActivity,
  type UserProfile,
} from '@/lib/anilist'
import { timeAgo } from '@/lib/time'

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/activity" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Activity
        </Link>
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || `Could not load profile for "${userName}".`}
        </p>
      </div>
    )
  }

  const stats = user.statistics.anime
  const hoursWatched = Math.round(stats.minutesWatched / 60)
  const daysWatched = (stats.minutesWatched / 1440).toFixed(1)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Activity
        </Link>
        {user.siteUrl && (
          <a
            href={user.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:text-primary"
          >
            Open on AniList <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* Banner & Avatar Header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-36 w-full bg-gradient-to-r from-primary/30 via-card to-secondary md:h-48">
          {user.bannerImage && (
            <img src={user.bannerImage} alt="" className="size-full object-cover opacity-80" />
          )}
        </div>
        <div className="relative flex flex-col gap-4 px-5 pb-6 pt-14 sm:flex-row sm:items-end sm:pt-5">
          <img
            src={user.avatar.large || user.avatar.medium || '/placeholder.svg'}
            alt={user.name}
            className="absolute -top-12 left-5 size-24 rounded-2xl border-4 border-card bg-muted object-cover shadow-lg sm:static sm:-mt-16 sm:size-28"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{user.name}</h1>
            {user.about ? (
              <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {user.about}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">AniList Community Member</p>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Film className="size-4 text-primary" /> Total Anime
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats.count.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tv className="size-4 text-primary" /> Episodes Watched
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats.episodesWatched.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-4 text-primary" /> Watch Time
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{daysWatched}d</p>
          <p className="text-xs text-muted-foreground">{hoursWatched.toLocaleString()} hours</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Star className="size-4 text-primary" /> Mean Score
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats.meanScore ? `${stats.meanScore}%` : '—'}</p>
        </div>
      </div>

      {/* Top Genres */}
      {stats.genres.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Top Genres</h2>
          <div className="flex flex-wrap gap-2">
            {stats.genres.map((g) => (
              <span
                key={g.genre}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-foreground"
              >
                <span>{g.genre}</span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
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
          <h2 className="text-lg font-semibold tracking-tight">Favorite Anime</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {user.favourites.anime.nodes.map((anime) => (
              <Link key={anime.id} href={`/anime/${anime.id}`} className="group flex flex-col gap-1.5">
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={anime.coverImage.large || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <p className="line-clamp-2 text-xs font-medium group-hover:text-primary">
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
          <h2 className="text-lg font-semibold tracking-tight">Favorite Characters</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {user.favourites.characters.nodes.map((char) => (
              <Link key={char.id} href={`/character/${char.id}`} className="group flex flex-col gap-1.5">
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={char.image.large || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <p className="line-clamp-1 text-xs font-medium group-hover:text-primary">{char.name.full}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent User Activity */}
      {(actData?.Page.activities ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Recent Updates</h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {actData!.Page.activities
              .filter((a) => a.media)
              .map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="capitalize text-muted-foreground">
                        {a.status ?? 'updated'}
                        {a.progress ? ` ${a.progress} of` : ''}
                      </span>{' '}
                      <Link href={`/anime/${a.media!.id}`} className="font-medium text-primary hover:underline">
                        {displayTitle(a.media!.title)}
                      </Link>
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{timeAgo(a.createdAt * 1000)}</span>
                      {a.likeCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Heart className="size-3 fill-primary" /> {a.likeCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/anime/${a.media!.id}`} className="shrink-0">
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
        </section>
      )}
    </div>
  )
}
