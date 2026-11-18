'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Search } from 'lucide-react'
import { SEARCH_QUERY, type MediaCard } from '@/lib/anilist'
import { AnimeGrid } from './anime-grid'
import { GenreBar } from './genre-bar'

const SORTS = [
  { value: 'SCORE_DESC', label: 'Top rated' },
  { value: 'POPULARITY_DESC', label: 'Most popular' },
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Search anime</h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search by title</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search by title…"
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setParams({ sort: e.target.value })}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
            >
              {q && <option value="SEARCH_MATCH">Best match</option>}
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <GenreBar selected={genre} onSelect={(g) => setParams({ genre: g })} />
      </div>

      <section aria-live="polite" aria-label="Results">
        <p className="mb-4 text-sm text-muted-foreground">
          {genre ? `Top ${genre} anime` : 'All anime'}
          {q ? ` matching “${q}”` : ''}
        </p>
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
