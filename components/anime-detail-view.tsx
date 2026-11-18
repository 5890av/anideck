'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Building2, ExternalLink, PlayCircle, Star } from 'lucide-react'
import { displayTitle, formatEnum, formatFuzzyDate, MEDIA_DETAIL_QUERY, type MediaDetail } from '@/lib/anilist'
import { AiringCountdown, StatusBadge } from './status-badge'
import { RichDescription } from './rich-description'
import { CharacterCard, StaffCard } from './person-card'
import { WatchlistControls } from './watchlist-controls'

export function AnimeDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Media: MediaDetail }>([MEDIA_DETAIL_QUERY, { id }])
  const media = data?.Media

  if (error && !media) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }
  if (isLoading || !media) return <DetailSkeleton />

  const title = displayTitle(media.title)
  const streaming = media.externalLinks.filter((l) => l.type === 'STREAMING')
  const facts: [string, string | number | null | undefined][] = [
    ['Format', formatEnum(media.format)],
    ['Episodes', media.episodes],
    ['Duration', media.duration ? `${media.duration} min` : null],
    ['Status', formatEnum(media.status)],
    ['Season', [formatEnum(media.season), media.seasonYear].filter(Boolean).join(' ') || null],
    ['Start date', formatFuzzyDate(media.startDate)],
    ['Source', formatEnum(media.source)],
    ['Popularity', media.popularity?.toLocaleString()],
  ]

  return (
    <article className="flex flex-col gap-8">
      <div className="relative -mx-4 -mt-6 h-40 overflow-hidden md:-mx-6 md:h-64">
        {media.bannerImage ? (
          <img src={media.bannerImage || "/placeholder.svg"} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full" style={{ backgroundColor: media.coverImage.color ?? 'var(--muted)' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="-mt-28 flex flex-col gap-6 md:-mt-36 md:flex-row">
        <div className="relative z-10 flex shrink-0 flex-col gap-4 md:w-56">
          {media.coverImage.large && (
            <img
              src={media.coverImage.large || "/placeholder.svg"}
              alt={`${title} cover art`}
              className="w-36 rounded-xl shadow-2xl ring-1 ring-border md:w-full"
            />
          )}
        </div>
        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-4 md:pt-24">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={media.status} />
            {media.averageScore != null && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="size-4 fill-upcoming text-upcoming" aria-hidden="true" /> {media.averageScore}%
              </span>
            )}
          </div>
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            {media.title.native && <p className="mt-1 text-sm text-muted-foreground">{media.title.native}</p>}
          </div>
          {media.status === 'RELEASING' && media.nextAiringEpisode && (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-airing/40 bg-airing/10 px-3 py-2 text-sm text-airing">
              <AiringCountdown next={media.nextAiringEpisode} />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {media.genres.map((g) => (
              <Link
                key={g}
                href={`/search?genre=${encodeURIComponent(g)}`}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                {g}
              </Link>
            ))}
          </div>
          <WatchlistControls media={media} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Synopsis</h2>
            <RichDescription text={media.description} className="text-sm" />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Characters &amp; voice actors</h2>
            {media.characters.edges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No characters listed yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {media.characters.edges.map((edge) => (
                  <CharacterCard
                    key={edge.node.id}
                    character={edge.node}
                    role={edge.role}
                    voiceActor={edge.voiceActors[0]}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Staff</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {media.studios.nodes.map((studio) => (
                <div key={`studio-${studio.id}`} className="flex gap-3 rounded-lg border border-border bg-card p-2">
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="truncate text-sm font-medium">{studio.name}</p>
                    <p className="text-xs text-muted-foreground">Animation Studio</p>
                  </div>
                </div>
              ))}
              {media.staff.edges.map((edge, i) => (
                <StaffCard key={`${edge.node.id}-${i}`} staff={edge.node} role={edge.role} />
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <PlayCircle className="size-4 text-primary" aria-hidden="true" /> Where to watch
            </h2>
            {streaming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No official streaming links listed.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {streaming.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: link.color ?? 'var(--muted)' }}
                      >
                        {link.icon ? (
                          <img src={link.icon || "/placeholder.svg"} alt="" className="size-4" />
                        ) : (
                          <PlayCircle className="size-4 text-white" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex-1">
                        {link.site}
                        {link.language && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">({link.language})</span>
                        )}
                      </span>
                      <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">(opens in new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Details</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {facts
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </aside>
      </div>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="-mx-4 -mt-6 h-40 animate-pulse bg-muted md:-mx-6 md:h-64" />
      <div className="flex gap-6">
        <div className="aspect-[2/3] w-36 animate-pulse rounded-xl bg-muted md:w-56" />
        <div className="flex flex-1 flex-col gap-3 pt-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
