'use client'

import useSWRInfinite from 'swr/infinite'
import { Building2, ExternalLink, Heart, Loader2 } from 'lucide-react'
import { STUDIO_QUERY, type StudioDetail } from '@/lib/anilist'
import { AnimeGrid } from './anime-grid'

type Response = { Studio: StudioDetail | null }

export function StudioDetailView({ id }: { id: number }) {
  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<Response>(
    (index, prev) => {
      if (prev && !prev.Studio?.media.pageInfo.hasNextPage) return null
      return [STUDIO_QUERY, { id, page: index + 1 }]
    },
    { revalidateFirstPage: false },
  )

  const studio = data?.[0]?.Studio
  const media = data
    ? [
        ...new Map(
          data.flatMap((p) => p.Studio?.media.nodes ?? []).filter((m) => !m.isAdult).map((m) => [m.id, m] as const),
        ).values(),
      ]
    : undefined
  const hasMore = data?.at(-1)?.Studio?.media.pageInfo.hasNextPage ?? false
  const loadingMore = isValidating && size > (data?.length ?? 0)

  if (error && !data) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center md:p-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Building2 className="size-8" aria-hidden="true" />
        </div>
        {isLoading || !studio ? (
          <div className="flex flex-1 flex-col gap-2" aria-busy="true">
            <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {studio.isAnimationStudio ? 'Animation studio' : 'Producer'}
            </p>
            <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">{studio.name}</h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <Heart className="size-4 fill-primary text-primary" aria-hidden="true" />
                <span className="font-semibold tabular-nums">{(studio.favourites ?? 0).toLocaleString()}</span>
                <span className="text-muted-foreground">favorites</span>
              </span>
              {studio.media.pageInfo.total != null && (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {studio.media.pageInfo.total.toLocaleString()}
                  </span>{' '}
                  titles
                </span>
              )}
              {studio.siteUrl && (
                <a
                  href={studio.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  View on AniList <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <section aria-labelledby="studio-anime" className="flex flex-col gap-4">
        <h2 id="studio-anime" className="text-lg font-semibold">
          Anime by popularity
        </h2>
        <AnimeGrid
          items={media}
          loading={isLoading}
          error={error}
          emptyMessage="This studio has no listed anime."
        />
        {hasMore && (
          <button
            type="button"
            onClick={() => setSize(size + 1)}
            disabled={loadingMore}
            className="mx-auto flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Load more
          </button>
        )}
      </section>
    </div>
  )
}
