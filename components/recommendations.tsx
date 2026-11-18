'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Star, ThumbsUp } from 'lucide-react'
import { displayTitle, formatEnum, type Recommendation } from '@/lib/anilist'

export function Recommendations({ items }: { items: Recommendation[] }) {
  const scroller = useRef<HTMLUListElement>(null)
  const recs = items.filter((r) => r.mediaRecommendation)

  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section aria-labelledby="recs-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 id="recs-heading" className="text-lg font-semibold">
          Recommended if you liked this
        </h2>
        {recs.length > 3 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="flex size-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"
              aria-label="Scroll recommendations left"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="flex size-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"
              aria-label="Scroll recommendations right"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {recs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No community recommendations yet.</p>
      ) : (
        <ul
          ref={scroller}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0"
        >
          {recs.map(({ rating, mediaRecommendation: m }) => {
            if (!m) return null
            const title = displayTitle(m.title)
            return (
              <li key={m.id} className="w-32 shrink-0 snap-start sm:w-36">
                <Link href={`/anime/${m.id}`} className="group flex flex-col gap-2">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                    {m.coverImage.large && (
                      <img
                        src={m.coverImage.large || '/placeholder.svg'}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                      <ThumbsUp className="size-3 text-airing" aria-hidden="true" />
                      <span className="sr-only">Upvotes:</span>
                      {(rating ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {[formatEnum(m.format), m.episodes ? `${m.episodes} eps` : null].filter(Boolean).join(' · ')}
                      {m.averageScore != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="size-3 fill-upcoming text-upcoming" aria-hidden="true" />
                          {m.averageScore}%
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
