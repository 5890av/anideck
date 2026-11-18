'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import { displayTitle, formatEnum, type MediaCard } from '@/lib/anilist'
import { AiringCountdown, StatusBadge } from './status-badge'

export function AnimeCard({ media, caption }: { media: MediaCard; caption?: string }) {
  const title = displayTitle(media.title)
  return (
    <Link
      href={`/anime/${media.id}`}
      className="group flex flex-col gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"
        style={{ backgroundColor: media.coverImage.color ?? undefined }}
      >
        {media.coverImage.large && (
          <img
            src={media.coverImage.large || "/placeholder.svg"}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={media.status} />
        </div>
        {media.averageScore != null && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
            <Star className="size-3 fill-upcoming text-upcoming" aria-hidden="true" />
            {media.averageScore}%
          </span>
        )}
        {media.status === 'RELEASING' && media.nextAiringEpisode && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent px-2 pb-2 pt-6">
            <AiringCountdown next={media.nextAiringEpisode} compact className="text-[11px] font-medium text-airing" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {caption ??
            [formatEnum(media.format), media.seasonYear, media.episodes ? `${media.episodes} eps` : null]
              .filter(Boolean)
              .join(' · ')}
        </p>
      </div>
    </Link>
  )
}
