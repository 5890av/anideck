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
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
    )
  }
  if (loading && !items) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
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
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-balance text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  )
}
