'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Heart } from 'lucide-react'
import {
  CHARACTER_QUERY,
  displayTitle,
  formatEnum,
  formatFuzzyDate,
  STAFF_QUERY,
  type CharacterDetail,
  type MediaCard,
  type StaffDetail,
} from '@/lib/anilist'
import { RichDescription } from './rich-description'
import { AnimeCard } from './anime-card'

function ErrorBox({ error }: { error: Error }) {
  return (
    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {error.message}
    </p>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:flex-row" aria-busy="true">
      <div className="aspect-[2/3] w-40 animate-pulse rounded-xl bg-muted md:w-56" />
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

function ProfileHeader({
  image,
  name,
  native,
  subtitle,
  favourites,
  facts,
  description,
}: {
  image: string | null
  name: string
  native: string | null
  subtitle?: string
  favourites: number | null
  facts: [string, string | number | null | undefined][]
  description: string | null
}) {
  const visible = facts.filter(([, v]) => v !== null && v !== undefined && v !== '')
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="flex shrink-0 flex-col gap-3 md:w-56">
        {image ? (
          <img src={image || "/placeholder.svg"} alt={`Portrait of ${name}`} className="w-40 rounded-xl ring-1 ring-border md:w-full" />
        ) : (
          <div className="aspect-[2/3] w-40 rounded-xl bg-muted md:w-full" />
        )}
        {visible.length > 0 && (
          <dl className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
            {visible.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-4xl">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {native && <span>{native}</span>}
            {subtitle && <span>{subtitle}</span>}
            {favourites != null && (
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                {favourites.toLocaleString()} favourites
              </span>
            )}
          </p>
        </div>
        <RichDescription text={description} className="text-sm" />
      </div>
    </div>
  )
}

function MediaGrid({ items }: { items: { media: MediaCard; caption: string; key: string }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing listed.</p>
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((i) => (
        <AnimeCard key={i.key} media={i.media} caption={i.caption} />
      ))}
    </div>
  )
}

export function CharacterDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Character: CharacterDetail }>([CHARACTER_QUERY, { id }])
  const c = data?.Character
  if (error && !c) return <ErrorBox error={error} />
  if (isLoading || !c) return <ProfileSkeleton />

  const voiceActors = new Map<number, (typeof c.media.edges)[number]['voiceActors'][number]>()
  c.media.edges.forEach((e) => e.voiceActors.forEach((va) => voiceActors.set(va.id, va)))

  return (
    <div className="flex flex-col gap-10">
      <ProfileHeader
        image={c.image.large}
        name={c.name.full}
        native={c.name.native}
        subtitle={c.name.alternative.filter(Boolean).slice(0, 3).join(', ') || undefined}
        favourites={c.favourites}
        description={c.description}
        facts={[
          ['Gender', c.gender],
          ['Age', c.age],
          ['Birthday', formatFuzzyDate(c.dateOfBirth)],
          ['Blood type', c.bloodType],
        ]}
      />

      {voiceActors.size > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Voiced by</h2>
          <div className="flex flex-wrap gap-3">
            {[...voiceActors.values()].map((va) => (
              <Link
                key={va.id}
                href={`/staff/${va.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 pr-4 hover:bg-accent"
              >
                {va.image.large ? (
                  <img src={va.image.large || "/placeholder.svg"} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <div className="size-12 rounded-full bg-muted" />
                )}
                <span className="text-sm font-medium">{va.name.full}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Appears in</h2>
        <MediaGrid
          items={c.media.edges.map((e) => ({
            key: String(e.node.id),
            media: e.node,
            caption: `${formatEnum(e.characterRole)} role${e.node.seasonYear ? ` · ${e.node.seasonYear}` : ''}`,
          }))}
        />
      </section>
    </div>
  )
}

export function StaffDetailView({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR<{ Staff: StaffDetail }>([STAFF_QUERY, { id }])
  const s = data?.Staff
  if (error && !s) return <ErrorBox error={error} />
  if (isLoading || !s) return <ProfileSkeleton />

  const roles = s.characterMedia.edges.flatMap((e) =>
    e.characters.map((ch) => ({ edge: e, character: ch })),
  )

  const productionMap = new Map<number, { media: MediaCard; roles: string[] }>()
  s.staffMedia.edges.forEach((e) => {
    const existing = productionMap.get(e.node.id)
    if (existing) existing.roles.push(e.staffRole)
    else productionMap.set(e.node.id, { media: e.node, roles: [e.staffRole] })
  })

  const years = s.yearsActive.length ? `${s.yearsActive[0]}${s.yearsActive[1] ? `–${s.yearsActive[1]}` : '–present'}` : null

  return (
    <div className="flex flex-col gap-10">
      <ProfileHeader
        image={s.image.large}
        name={s.name.full}
        native={s.name.native}
        subtitle={s.primaryOccupations.join(', ') || undefined}
        favourites={s.favourites}
        description={s.description}
        facts={[
          ['Language', s.languageV2],
          ['Gender', s.gender],
          ['Age', s.age],
          ['Birthday', formatFuzzyDate(s.dateOfBirth)],
          ['Died', formatFuzzyDate(s.dateOfDeath)],
          ['Hometown', s.homeTown],
          ['Years active', years],
          ['Blood type', s.bloodType],
        ]}
      />

      {roles.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Voice roles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map(({ edge, character }) => (
              <div
                key={`${edge.node.id}-${character.id}`}
                className="flex overflow-hidden rounded-lg border border-border bg-card"
              >
                <Link href={`/character/${character.id}`} className="flex min-w-0 flex-1 gap-3 p-2 hover:bg-accent">
                  {character.image.medium ? (
                    <img src={character.image.medium || "/placeholder.svg"} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-16 w-12 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="truncate text-sm font-medium">{character.name.full}</p>
                    <p className="text-xs text-muted-foreground">{formatEnum(edge.characterRole)}</p>
                  </div>
                </Link>
                <Link
                  href={`/anime/${edge.node.id}`}
                  className="flex min-w-0 flex-1 flex-row-reverse gap-3 border-l border-border p-2 text-right hover:bg-accent"
                >
                  {edge.node.coverImage.large ? (
                    <img src={edge.node.coverImage.large || "/placeholder.svg"} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-16 w-12 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="line-clamp-2 text-sm font-medium">{displayTitle(edge.node.title)}</p>
                    <p className="text-xs text-muted-foreground">{edge.node.seasonYear}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {productionMap.size > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Production roles</h2>
          <MediaGrid
            items={[...productionMap.values()].map((p) => ({
              key: String(p.media.id),
              media: p.media,
              caption: p.roles.join(', '),
            }))}
          />
        </section>
      )}
    </div>
  )
}
