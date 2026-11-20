'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { SEARCH_QUERY, type MediaCard } from '@/lib/anilist'
import { cn } from '@/lib/utils'
import { AnimeGrid } from './anime-grid'
import { GenreBar } from './genre-bar'

const SORTS = [
  { value: 'SCORE_DESC', label: 'Top Rated' },
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'START_DATE_DESC', label: 'Newest' },
]

export function SearchView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const genre = params.get('genre')
  const requestedSort = params.get('sort') ?? (q ? 'SEARCH_MATCH' : 'SCORE_DESC')
  const sort = !q && requestedSort === 'SEARCH_MATCH' ? 'SCORE_DESC' : requestedSort

  const [input, setInput] = useState(q)

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  useEffect(() => {
    const trimmed = input.trim()
    if (trimmed === q) return
    const t = setTimeout(() => setParams({ q: trimmed || null }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  const { data, isLoading, error } = useSWR<{ Page: { media: MediaCard[] } }>([
    SEARCH_QUERY,
    { search: q || undefined, genre: genre || undefined, sort: [sort], page: 1 },
  ])

  const availableSorts = q ? [{ value: 'SEARCH_MATCH', label: 'Best Match' }, ...SORTS] : SORTS

  return (
    <div className="flex flex-col gap-6">
      {/* Editorial Search Command Header */}
      <div className="glass-panel flex flex-col gap-4 rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1.5 rounded-full active-pill" aria-hidden="true" />
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Explore &amp; Search
            </h1>
          </div>
          {(q || genre) && (
            <button
              type="button"
              onClick={() => {
                setInput('')
                setParams({ q: null, genre: null, sort: 'SCORE_DESC' })
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:border-primary hover:text-primary"
            >
              <X className="size-3.5" /> Reset Filters
            </button>
          )}
        </div>

        {/* Pill Search Bar */}
        <label className="relative block">
          <span className="sr-only">Search by title</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search anime titles, studios, or series…"
            className="h-12 w-full rounded-full border border-white/12 bg-[#0E1015]/85 pl-11 pr-11 text-sm font-medium text-white outline-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput('')
                setParams({ q: null })
              }}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-primary hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>

        {/* Interactive Sort Pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" /> Sort:
          </span>
          {availableSorts.map((s) => {
            const active = sort === s.value
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setParams({ sort: s.value })}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all',
                  active
                    ? 'active-pill'
                    : 'border border-white/10 bg-[#0E1015]/70 text-slate-300 hover:border-primary/40 hover:text-white',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <GenreBar selected={genre} onSelect={(g) => setParams({ genre: g })} />
      </div>

      {/* Results Section */}
      <section aria-live="polite" aria-label="Results" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-upcoming" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-200">
              {genre ? `Top ${genre} Anime` : 'Catalog Results'}
              {q ? ` matching “${q}”` : ''}
            </p>
          </div>
          {data?.Page.media && (
            <span className="rounded-full px-3 py-0.5 text-xs font-extrabold amber-pill">
              {data.Page.media.length} Titles
            </span>
          )}
        </div>

        <AnimeGrid
          items={data?.Page.media}
          loading={isLoading}
          error={error}
          skeletonCount={18}
          emptyMessage="No anime matched your filters."
        />
      </section>
    </div>
  )
}
