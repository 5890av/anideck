import { NextResponse } from 'next/server'

type ThemeItem = {
  id: string
  type: 'OP' | 'ED'
  slug: string
  songTitle: string
  artists: string[]
  episodes: string | null
  videoUrl: string | null
}

function parseJikanTheme(raw: string, type: 'OP' | 'ED', idx: number): ThemeItem {
  const cleaned = raw.replace(/^\d+:\s*/, '').trim()
  const epMatch = cleaned.match(/\(([^)]+)\)\s*$/)
  const episodes = epMatch ? epMatch[1].replace(/^eps?\s*/i, '') : null
  const withoutEp = epMatch ? cleaned.slice(0, epMatch.index).trim() : cleaned

  const titleMatch = withoutEp.match(/^"([^"]+)"\s*(?:by\s*(.+))?$/i)
  if (titleMatch) {
    return {
      id: `jikan-${type}-${idx}`,
      type,
      slug: `${type}${idx + 1}`,
      songTitle: titleMatch[1].trim(),
      artists: titleMatch[2] ? [titleMatch[2].trim()] : [],
      episodes,
      videoUrl: null,
    }
  }

  return {
    id: `jikan-${type}-${idx}`,
    type,
    slug: `${type}${idx + 1}`,
    songTitle: withoutEp || `${type} ${idx + 1}`,
    artists: [],
    episodes,
    videoUrl: null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ themes: [], error: 'Missing id' })
  }

  try {
    // 1. Get exact MAL ID (idMal) from AniList GraphQL
    const gqlRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: 'query ($id: Int) { Media(id: $id, type: ANIME) { idMal title { romaji english } } }',
        variables: { id },
      }),
      cache: 'no-store',
    })

    if (!gqlRes.ok) {
      return NextResponse.json({ themes: [], error: `AniList status ${gqlRes.status}` })
    }

    const gqlJson = await gqlRes.json()
    const media = gqlJson?.data?.Media
    let malId: number | null = media?.idMal ?? null

    if (!malId) {
      const title = media?.title?.romaji || media?.title?.english
      if (title) {
        const searchRes = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
          { cache: 'no-store' },
        )
        if (searchRes.ok) {
          const searchJson = await searchRes.json()
          malId = searchJson?.data?.[0]?.mal_id ?? null
        }
      }
    }

    if (!malId) {
      return NextResponse.json({ themes: [], error: 'No MAL ID found' })
    }

    // 2. Fetch OP/ED themes from MyAnimeList (Jikan)
    const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/themes`, {
      cache: 'no-store',
    })

    if (!jikanRes.ok) {
      return NextResponse.json({ themes: [], error: `MAL status ${jikanRes.status}` })
    }

    const jikanJson = await jikanRes.json()
    const ops: string[] = Array.isArray(jikanJson?.data?.openings) ? jikanJson.data.openings : []
    const eds: string[] = Array.isArray(jikanJson?.data?.endings) ? jikanJson.data.endings : []

    const themes: ThemeItem[] = [
      ...ops.map((raw, idx) => parseJikanTheme(raw, 'OP', idx)),
      ...eds.map((raw, idx) => parseJikanTheme(raw, 'ED', idx)),
    ]

    return NextResponse.json({ themes, malId })
  } catch (err: any) {
    return NextResponse.json({ themes: [], error: err?.message || 'Theme lookup failed' })
  }
}
