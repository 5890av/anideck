'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Building2, Dna, ExternalLink, Info, PlayCircle, Sparkles, Star } from 'lucide-react'
import { displayTitle, formatEnum, formatFuzzyDate, MEDIA_DETAIL_QUERY, type MediaDetail } from '@/lib/anilist'
import { AiringCountdown, StatusBadge } from './status-badge'
import { RichDescription } from './rich-description'
import { CharacterCard, StaffCard } from './person-card'
import { WatchlistControls } from './watchlist-controls'
import { Recommendations } from './recommendations'

export function AnimeDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Media: MediaDetail }>([MEDIA_DETAIL_QUERY, { id }])
  const media = data?.Media

  if (error && !media) {
    return (
      <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }
  if (isLoading || !media) return <DetailSkeleton />

  const title = displayTitle(media.title)
  const streaming = media.externalLinks.filter((l) => l.type === 'STREAMING')
  const studios = [...media.studios.edges].sort((a, b) => Number(b.isMain) - Number(a.isMain))
  const mainStudios = studios.filter((s) => s.isMain)
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

  const heroBackdrop = media.bannerImage || media.coverImage.large

  return (
    <article className="flex flex-col gap-8">
      {/* Top Navigation & Quick Actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
        </Link>
        <Link
          href="/dna"
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur-md transition-colors hover:bg-primary hover:text-white"
        >
          <Dna className="size-3.5" aria-hidden="true" /> Compare DNA
        </Link>
      </div>

      {/* Glassmorphic Cinema Hero Card */}
      <div className="glass-panel relative overflow-hidden rounded-3xl shadow-2xl">
        {/* Ambient Blurred Backdrop */}
        {heroBackdrop && (
          <img
            src={heroBackdrop}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/75 to-[#09090B]/30 sm:bg-gradient-to-r sm:from-[#09090B]/95 sm:via-[#09090B]/75 sm:to-[#09090B]/35"
        />

        <div className="relative z-10 flex flex-col gap-6 p-5 sm:flex-row sm:items-start md:gap-8 md:p-8">
          {/* Poster Art */}
          {media.coverImage.large && (
            <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48 md:w-56">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-muted shadow-2xl">
                <img
                  src={media.coverImage.large}
                  alt={`${title} cover art`}
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Hero Metadata & Watchlist Controls */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={media.status} />
              {media.averageScore != null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-xs font-bold text-upcoming backdrop-blur-md">
                  <Star className="size-3.5 fill-upcoming text-upcoming" aria-hidden="true" /> {media.averageScore}%
                </span>
              )}
              {media.format && (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {formatEnum(media.format)}
                  {media.episodes ? ` · ${media.episodes} eps` : ''}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-balance text-2xl font-extrabold tracking-tight text-white md:text-4xl">
                {title}
              </h1>
              {media.title.native && (
                <p className="mt-1 text-sm text-muted-foreground">{media.title.native}</p>
              )}
            </div>

            {mainStudios.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <Building2 className="size-3.5 text-primary" aria-hidden="true" />
                <span className="sr-only">Studio:</span>
                {mainStudios.map(({ node }, i) => (
                  <span key={node.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-muted-foreground" aria-hidden="true">·</span>}
                    <Link
                      href={`/studio/${node.id}`}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {node.name}
                    </Link>
                  </span>
                ))}
              </div>
            )}

            {media.status === 'RELEASING' && media.nextAiringEpisode && (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-airing/30 bg-airing/15 px-3.5 py-1.5 text-xs font-semibold text-airing backdrop-blur-md">
                <AiringCountdown next={media.nextAiringEpisode} />
              </div>
            )}

            {media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {media.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/search?genre=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-foreground/90 backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-1">
              <WatchlistControls media={media} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content + Glassmorphic Sidebar */}
      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Glassmorphic Synopsis Panel */}
          <section className="glass-panel rounded-3xl p-5 md:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> Synopsis
            </h2>
            <RichDescription text={media.description} className="text-sm leading-relaxed text-foreground/90" />
          </section>

          <Recommendations items={media.recommendations.nodes} />

          {/* Characters & Voice Actors */}
          <section>
            <h2 className="mb-3 text-base font-bold text-white">Characters &amp; voice actors</h2>
            {media.characters.edges.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">
                No characters listed yet.
              </div>
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

          {/* Staff & Studios */}
          <section>
            <h2 className="mb-3 text-base font-bold text-white">Staff &amp; studios</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {studios.map(({ node: studio, isMain }) => (
                <Link
                  key={`studio-${studio.id}`}
                  href={`/studio/${studio.id}`}
                  className="glass-card group flex gap-3 rounded-2xl p-2.5"
                >
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Building2 className="size-5 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="truncate text-sm font-semibold text-white group-hover:text-primary">{studio.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isMain ? 'Main studio' : studio.isAnimationStudio ? 'Animation studio' : 'Producer'}
                    </p>
                  </div>
                </Link>
              ))}
              {media.staff.edges.map((edge, i) => (
                <StaffCard key={`${edge.node.id}-${i}`} staff={edge.node} role={edge.role} />
              ))}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="glass-panel rounded-3xl p-5">
            <h2 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-white">
              <PlayCircle className="size-4 text-primary" aria-hidden="true" /> Where to watch
            </h2>
            {streaming.length === 0 ? (
              <p className="text-xs text-muted-foreground">No official streaming links listed.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {streaming.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-card flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold text-white"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: link.color ?? 'var(--muted)' }}
                      >
                        {link.icon ? (
                          <img src={link.icon} alt="" className="size-4" />
                        ) : (
                          <PlayCircle className="size-4 text-white" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex-1 truncate">
                        {link.site}
                        {link.language && (
                          <span className="ml-1 font-normal text-muted-foreground">({link.language})</span>
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

          <section className="glass-panel rounded-3xl p-5">
            <h2 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-white">
              <Info className="size-4 text-primary" aria-hidden="true" /> Details
            </h2>
            <dl className="flex flex-col divide-y divide-white/[0.06] text-xs">
              {facts
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-semibold text-white">{v}</dd>
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
      <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-card md:h-80" />
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-card" />
        <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-card" />
      </div>
    </div>
  )
}
