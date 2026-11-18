'use client'

import useSWR from 'swr'
import { GENRES_QUERY } from '@/lib/anilist'
import { cn } from '@/lib/utils'

const HIDDEN = new Set(['Hentai'])

export function GenreBar({ selected, onSelect }: { selected: string | null; onSelect: (genre: string | null) => void }) {
  const { data, isLoading } = useSWR<{ GenreCollection: string[] }>([GENRES_QUERY, {}], { dedupingInterval: 3_600_000 })
  const genres = data?.GenreCollection.filter((g) => !HIDDEN.has(g)) ?? []

  return (
    <div role="group" aria-label="Filter by genre" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-2 pb-1 md:w-auto md:flex-wrap">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          All genres
        </Chip>
        {isLoading &&
          Array.from({ length: 10 }).map((_, i) => <span key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />)}
        {genres.map((g) => (
          <Chip key={g} active={selected === g} onClick={() => onSelect(selected === g ? null : g)}>
            {g}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
