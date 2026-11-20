'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Clapperboard,
  Dna,
  Mic,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { anilist, displayTitle, formatEnum } from '@/lib/anilist'
import { cn } from '@/lib/utils'

const DNA_SEARCH_QUERY = `
  query DnaSearch($search: String) {
    Page(page: 1, perPage: 8) {
      media(type: ANIME, isAdult: false, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id
        title { romaji english }
        coverImage { large medium }
        seasonYear
        format
        averageScore
      }
    }
  }
`

const DNA_DETAIL_QUERY = `
  query DnaDetail($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english }
      coverImage { large medium }
      bannerImage
      seasonYear
      format
      episodes
      averageScore
      genres
      studios {
        nodes {
          id
          name
          isAnimationStudio
        }
      }
      staff(perPage: 25, sort: [RELEVANCE, ID]) {
        edges {
          role
          node {
            id
            name { full }
            image { medium }
          }
        }
      }
      characters(perPage: 50, sort: [ROLE, FAVOURITES_DESC]) {
        edges {
          role
          node {
            id
            name { full }
            image { medium }
          }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
            id
            name { full }
            image { medium }
          }
        }
      }
    }
  }
`

type SearchHit = {
  id: number
  title: { romaji: string; english: string | null }
  coverImage: { large: string | null; medium: string | null }
  seasonYear: number | null
  format: string | null
  averageScore: number | null
}

type MediaDnaData = SearchHit & {
  bannerImage: string | null
  episodes: number | null
  genres: string[]
  studios: {
    nodes: { id: number; name: string; isAnimationStudio: boolean }[]
  }
  staff: {
    edges: {
      role: string
      node: { id: number; name: { full: string }; image: { medium: string | null } }
    }[]
  }
  characters: {
    edges: {
      role: string
      node: { id: number; name: { full: string }; image: { medium: string | null } }
      voiceActors: { id: number; name: { full: string }; image: { medium: string | null } }[]
    }[]
  }
}

const PRESET_PAIRS: { label: string; aId: number; bId: number }[] = [
  { label: 'Jujutsu Kaisen × Chainsaw Man', aId: 113415, bId: 127230 },
  { label: 'Demon Slayer × Attack on Titan', aId: 101922, bId: 16498 },
  { label: 'Solo Leveling × Sword Art Online', aId: 151807, bId: 11757 },
  { label: 'Death Note × Code Geass', aId: 1535, bId: 1575 },
]

export default function DnaFinderPage() {
  const [idA, setIdA] = useState<number | null>(113415)
  const [idB, setIdB] = useState<number | null>(127230)
  const [mediaA, setMediaA] = useState<MediaDnaData | null>(null)
  const [mediaB, setMediaB] = useState<MediaDnaData | null>(null)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)

  useEffect(() => {
    if (!idA) {
      setMediaA(null)
      return
    }
    let cancelled = false
    setLoadingA(true)
    anilist<{ Media: MediaDnaData }>(DNA_DETAIL_QUERY, { id: idA })
      .then((res) => {
        if (!cancelled) setMediaA(res.Media)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingA(false)
      })
    return () => {
      cancelled = true
    }
  }, [idA])

  useEffect(() => {
    if (!idB) {
      setMediaB(null)
      return
    }
    let cancelled = false
    setLoadingB(true)
    anilist<{ Media: MediaDnaData }>(DNA_DETAIL_QUERY, { id: idB })
      .then((res) => {
        if (!cancelled) setMediaB(res.Media)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingB(false)
      })
    return () => {
      cancelled = true
    }
  }, [idB])

  const dnaMatches = useMemo(() => {
    if (!mediaA || !mediaB) return null

    // 1. Shared Studios
    const studiosB = new Map(mediaB.studios.nodes.map((s) => [s.id, s]))
    const sharedStudios = mediaA.studios.nodes.filter((s) => studiosB.has(s.id))

    // 2. Shared Genres
    const genresB = new Set(mediaB.genres)
    const sharedGenres = mediaA.genres.filter((g) => genresB.has(g))

    // 3. Shared Staff
    const staffBMap = new Map<number, { name: string; image: string | null; rolesB: string[] }>()
    for (const edge of mediaB.staff.edges) {
      const existing = staffBMap.get(edge.node.id)
      if (existing) {
        if (!existing.rolesB.includes(edge.role)) existing.rolesB.push(edge.role)
      } else {
        staffBMap.set(edge.node.id, {
          name: edge.node.name.full,
          image: edge.node.image.medium,
          rolesB: [edge.role],
        })
      }
    }

    const sharedStaffMap = new Map<
      number,
      { id: number; name: string; image: string | null; rolesA: string[]; rolesB: string[] }
    >()
    for (const edge of mediaA.staff.edges) {
      const matchB = staffBMap.get(edge.node.id)
      if (!matchB) continue
      const cur = sharedStaffMap.get(edge.node.id)
      if (cur) {
        if (!cur.rolesA.includes(edge.role)) cur.rolesA.push(edge.role)
      } else {
        sharedStaffMap.set(edge.node.id, {
          id: edge.node.id,
          name: edge.node.name.full,
          image: edge.node.image.medium,
          rolesA: [edge.role],
          rolesB: matchB.rolesB,
        })
      }
    }
    const sharedStaff = Array.from(sharedStaffMap.values())

    // 4. Shared Voice Actors (Seiyuu)
    type CharEntry = { id: number; name: string; image: string | null; role: string }
    const vaMapB = new Map<
      number,
      { id: number; name: string; image: string | null; charsB: CharEntry[] }
    >()

    for (const edge of mediaB.characters.edges) {
      for (const va of edge.voiceActors) {
        const entry = vaMapB.get(va.id) ?? {
          id: va.id,
          name: va.name.full,
          image: va.image.medium,
          charsB: [],
        }
        if (!entry.charsB.some((c) => c.id === edge.node.id)) {
          entry.charsB.push({
            id: edge.node.id,
            name: edge.node.name.full,
            image: edge.node.image.medium,
            role: edge.role,
          })
        }
        vaMapB.set(va.id, entry)
      }
    }

    const sharedVaMap = new Map<
      number,
      {
        id: number
        name: string
        image: string | null
        charsA: CharEntry[]
        charsB: CharEntry[]
      }
    >()

    for (const edge of mediaA.characters.edges) {
      for (const va of edge.voiceActors) {
        const matchB = vaMapB.get(va.id)
        if (!matchB) continue
        const cur = sharedVaMap.get(va.id) ?? {
          id: va.id,
          name: va.name.full,
          image: va.image.medium,
          charsA: [],
          charsB: matchB.charsB,
        }
        if (!cur.charsA.some((c) => c.id === edge.node.id)) {
          cur.charsA.push({
            id: edge.node.id,
            name: edge.node.name.full,
            image: edge.node.image.medium,
            role: edge.role,
          })
        }
        sharedVaMap.set(va.id, cur)
      }
    }

    const sharedVAs = Array.from(sharedVaMap.values())
    const dnaScore = Math.min(
      100,
      sharedStudios.length * 25 + sharedVAs.length * 12 + sharedStaff.length * 8 + sharedGenres.length * 5,
    )

    return { sharedStudios, sharedGenres, sharedStaff, sharedVAs, dnaScore }
  }, [mediaA, mediaB])

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Dna className="size-7 text-primary" />
            Anime DNA Connection Finder
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare any two anime to uncover shared Japanese voice actors, directors, composers, and studios.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PAIRS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setIdA(p.aId)
                setIdB(p.bId)
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Anime Selector Slots */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimeSelectorSlot
          slotLabel="Anime A"
          selected={mediaA}
          loading={loadingA}
          onSelect={(id) => setIdA(id)}
          onClear={() => setIdA(null)}
        />
        <AnimeSelectorSlot
          slotLabel="Anime B"
          selected={mediaB}
          loading={loadingB}
          onSelect={(id) => setIdB(id)}
          onClear={() => setIdB(null)}
        />
      </div>

      {/* DNA Results */}
      {dnaMatches && mediaA && mediaB && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Summary Banner */}
          <div className="glass-panel flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground active-pill">
                {dnaMatches.dnaScore}%
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Creative DNA Match</p>
                <h2 className="text-base font-bold text-white sm:text-lg">
                  {dnaMatches.sharedVAs.length} Shared Voice Actors · {dnaMatches.sharedStaff.length} Shared Staff ·{' '}
                  {dnaMatches.sharedStudios.length} Shared Studios
                </h2>
              </div>
            </div>

            {dnaMatches.sharedStudios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dnaMatches.sharedStudios.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary"
                  >
                    <Building2 className="size-3.5" /> {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Shared Voice Actors (Seiyuu) */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" />
              <h3 className="text-base font-bold">
                Shared Japanese Voice Actors ({dnaMatches.sharedVAs.length})
              </h3>
            </div>

            {dnaMatches.sharedVAs.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-center text-xs text-muted-foreground">
                No overlapping Japanese voice actors found among the main cast of these two titles.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {dnaMatches.sharedVAs.map((va) => (
                  <div
                    key={va.id}
                    className="glass-card flex items-center justify-between gap-3 rounded-2xl p-3.5"
                  >
                    {/* Character A */}
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <img
                        src={va.charsA[0]?.image || '/placeholder.svg'}
                        alt={va.charsA[0]?.name}
                        className="size-12 shrink-0 rounded-xl border border-white/10 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{va.charsA[0]?.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {displayTitle(mediaA.title)}
                        </p>
                      </div>
                    </div>

                    {/* Center Seiyuu Badge */}
                    <div className="flex shrink-0 flex-col items-center gap-1 px-1 text-center">
                      <img
                        src={va.image || '/placeholder.svg'}
                        alt={va.name}
                        className="size-11 rounded-full border-2 border-primary object-cover shadow-md"
                      />
                      <span className="max-w-[96px] truncate text-[11px] font-bold text-primary">
                        {va.name}
                      </span>
                    </div>

                    {/* Character B */}
                    <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2.5 text-right">
                      <img
                        src={va.charsB[0]?.image || '/placeholder.svg'}
                        alt={va.charsB[0]?.name}
                        className="size-12 shrink-0 rounded-xl border border-white/10 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{va.charsB[0]?.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {displayTitle(mediaB.title)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Shared Staff & Creators */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clapperboard className="size-4 text-primary" />
              <h3 className="text-base font-bold">
                Shared Directors, Composers & Staff ({dnaMatches.sharedStaff.length})
              </h3>
            </div>

            {dnaMatches.sharedStaff.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-center text-xs text-muted-foreground">
                No overlapping production staff found between these two titles.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dnaMatches.sharedStaff.map((st) => (
                  <div key={st.id} className="glass-card flex items-center gap-3 rounded-2xl p-3">
                    <img
                      src={st.image || '/placeholder.svg'}
                      alt={st.name}
                      className="size-12 shrink-0 rounded-full border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{st.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-primary">
                        A: {st.rolesA.slice(0, 2).join(', ')}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        B: {st.rolesB.slice(0, 2).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function AnimeSelectorSlot({
  slotLabel,
  selected,
  loading,
  onSelect,
  onClear,
}: {
  slotLabel: string
  selected: MediaDnaData | null
  loading: boolean
  onSelect: (id: number) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      anilist<{ Page: { media: SearchHit[] } }>(DNA_SEARCH_QUERY, { search: trimmed })
        .then((res) => setResults(res?.Page?.media ?? []))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <div className="glass-panel relative flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <Users className="size-3.5" /> {slotLabel}
        </span>
        {selected && (
          <button
            type="button"
            onClick={() => {
              onClear()
              setQuery('')
            }}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-white"
          >
            <X className="size-3" /> Change
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : selected ? (
        <div className="flex items-center gap-3.5">
          <Link href={`/anime/${selected.id}`} className="shrink-0">
            <img
              src={selected.coverImage.large || '/placeholder.svg'}
              alt={displayTitle(selected.title)}
              className="h-24 w-16 rounded-xl border border-white/10 object-cover"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/anime/${selected.id}`}
              className="line-clamp-2 text-sm font-bold text-white hover:text-primary"
            >
              {displayTitle(selected.title)}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {[formatEnum(selected.format), selected.seasonYear, selected.episodes ? `${selected.episodes} eps` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {selected.studios.nodes.length > 0 && (
              <p className="mt-1 truncate text-xs font-medium text-primary">
                {selected.studios.nodes.map((s) => s.name).join(', ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${slotLabel} (e.g. Jujutsu Kaisen)...`}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 text-xs text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {(results.length > 0 || searching) && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-[#121215] p-1.5 shadow-xl">
              {searching ? (
                <p className="p-3 text-center text-xs text-muted-foreground">Searching AniList...</p>
              ) : (
                results.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      onSelect(hit.id)
                      setQuery('')
                      setResults([])
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <img
                      src={hit.coverImage.medium || '/placeholder.svg'}
                      alt=""
                      className="h-10 w-7 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{displayTitle(hit.title)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[formatEnum(hit.format), hit.seasonYear].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
