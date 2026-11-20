import type { MediaCard } from '@/lib/anilist'
import { AnimeCard } from './anime-card'

export function AnimeGrid({
  items,
  loading,
  error,
  emptyMessage = 'No anime found.',
  skeletonCount = 12,
}: {
  items: MediaCard[] | undefined
  loading?: boolean
  error?: Error
  emptyMessage?: string
  skeletonCount?: number
}) {
  if (error && !items) {
    return (
      <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }
  if (loading && !items) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-3xl border border-white/10 bg-[#161922]/70 p-2.5">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />
            <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    )
  }
  if (!items || items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((m) => (
        <AnimeCard key={m.id} media={m} />
      ))}
    </div>
  )
}

export function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full active-pill" aria-hidden="true" />
        <h2 className="text-balance text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
