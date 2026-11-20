'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import { displayTitle, formatEnum, type MediaCard } from '@/lib/anilist'
import { AiringCountdown } from './status-badge'

export function AnimeCard({ media, caption }: { media: MediaCard; caption?: string }) {
  const title = displayTitle(media.title)

  const leftBadge = media.nextAiringEpisode
    ? `EP ${media.nextAiringEpisode.episode}`
    : media.episodes
      ? `${media.episodes} EPS`
      : formatEnum(media.format)

  const rightBadge =
    media.status === 'RELEASING'
      ? 'Ongoing'
      : [formatEnum(media.season), media.seasonYear].filter(Boolean).join(' ') || formatEnum(media.status)

  return (
    <Link
      href={`/anime/${media.id}`}
      className="glass-card group flex flex-col gap-2.5 rounded-3xl border-[#FF6B4A]/30 p-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-muted"
        style={{ backgroundColor: media.coverImage.color ?? undefined }}
      >
        {media.coverImage.large && (
          <img
            src={media.coverImage.large || '/placeholder.svg'}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* Top-Left Sunset Coral Episode Pill */}
        {leftBadge && (
          <span className="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide active-pill">
            {leftBadge}
          </span>
        )}

        {/* Top-Right Warm Amber Season / Ongoing Pill */}
        {rightBadge && (
          <span className="absolute right-2 top-2 max-w-[55%] truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold amber-pill">
            {rightBadge}
          </span>
        )}

        {/* Live Airing Countdown Strip */}
        {media.status === 'RELEASING' && media.nextAiringEpisode && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0E1015] via-[#0E1015]/85 to-transparent px-2.5 pb-2 pt-6">
            <AiringCountdown next={media.nextAiringEpisode} compact className="text-[11px] font-bold text-airing" />
          </div>
        )}
      </div>

      {/* Editorial Footer: Title + Score & Format */}
      <div className="flex flex-col gap-1 px-1 pb-0.5">
        <h3 className="line-clamp-1 text-sm font-bold leading-snug text-white transition-colors group-hover:text-primary">
          {title}
        </h3>
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
          {media.averageScore != null ? (
            <span className="inline-flex items-center gap-1 text-slate-200">
              <Star className="size-3 fill-upcoming text-upcoming" aria-hidden="true" />
              {media.averageScore}% Score
            </span>
          ) : (
            <span>{formatEnum(media.format) || 'Anime'}</span>
          )}
          <span className="truncate text-slate-400">
            {caption ?? [formatEnum(media.format), media.seasonYear].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
    </Link>
  )
}
