'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowRight } from 'lucide-react'
import { HOME_QUERY, SEARCH_QUERY, type MediaCard } from '@/lib/anilist'
import { AnimeGrid, SectionHeading } from './anime-grid'
import { GenreBar } from './genre-bar'

type HomeData = Record<'trending' | 'airing' | 'upcoming', { media: MediaCard[] }>

export function HomeView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const genre = params.get('genre')

  const home = useSWR<HomeData>(genre ? null : [HOME_QUERY, {}])
  const byGenre = useSWR<{ Page: { media: MediaCard[] } }>(
    genre ? [SEARCH_QUERY, { genre, sort: ['SCORE_DESC'], page: 1 }] : null,
  )

  const selectGenre = (g: string | null) => {
    router.replace(g ? `${pathname}?genre=${encodeURIComponent(g)}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Your deck for everything <span className="text-primary">anime</span>.
          </h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Live airing countdowns, a weekly release calendar, character and staff deep-dives, and a watchlist that
            keeps score — all powered by AniList.
          </p>
        </div>
        <GenreBar selected={genre} onSelect={selectGenre} />
      </section>

      {genre ? (
        <section aria-live="polite">
          <SectionHeading title={`Top ${genre} anime`}>
            <Link
              href={`/search?genre=${encodeURIComponent(genre)}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              Refine in Search <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </SectionHeading>
          <AnimeGrid
            items={byGenre.data?.Page.media}
            loading={byGenre.isLoading}
            error={byGenre.error}
            skeletonCount={18}
          />
        </section>
      ) : (
        <>
          <section>
            <SectionHeading title="Trending now" />
            <AnimeGrid items={home.data?.trending.media} loading={home.isLoading} error={home.error} />
          </section>
          <section>
            <SectionHeading title="Currently airing">
              <Link href="/calendar" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                Weekly calendar <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </SectionHeading>
            <AnimeGrid items={home.data?.airing.media} loading={home.isLoading} error={home.error} />
          </section>
          <section>
            <SectionHeading title="Upcoming" />
            <AnimeGrid items={home.data?.upcoming.media} loading={home.isLoading} error={home.error} />
          </section>
        </>
      )}
    </div>
  )
}
