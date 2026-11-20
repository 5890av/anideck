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

async function fetchWithTimeout(url: string, ms = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Anideck/1.0' },
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const title = searchParams.get('title') || ''

  if (!id) {
    return NextResponse.json({ themes: [] })
  }

  // 1. Query AnimeThemes via /resource using AniList ID
  try {
    const resourceUrl = `https://api.animethemes.moe/resource?filter[site]=AniList&filter[external_id]=${encodeURIComponent(id)}&include=anime.animethemes.song.artists,anime.animethemes.animethemeentries.videos`
    const res = await fetchWithTimeout(resourceUrl, 6000)
    if (res.ok) {
      const json = await res.json()
      const resources: any[] = Array.isArray(json?.resources) ? json.resources : []
      const match = resources.find(
        (r) => Array.isArray(r?.anime) && r.anime.length > 0 && Array.isArray(r.anime[0]?.animethemes),
      )
      const rawThemes: any[] = match ? match.anime[0].animethemes : []

      if (rawThemes.length > 0) {
        const themes: ThemeItem[] = rawThemes.map((t, i) => {
          const song = t?.song ?? {}
          const artistsArr: any[] = Array.isArray(song.artists) ? song.artists : []
          const entries: any[] = Array.isArray(t?.animethemeentries) ? t.animethemeentries : []
          const firstEntry = entries[0] ?? {}
          const videos: any[] = Array.isArray(firstEntry.videos) ? firstEntry.videos : []
          const firstVideo = videos[0] ?? {}

          return {
            id: `at-${t?.id ?? i}`,
            type: t?.type === 'ED' ? 'ED' : 'OP',
            slug: String(t?.slug || t?.type || `OP${i + 1}`),
            songTitle: typeof song.title === 'string' && song.title ? song.title : 'Untitled Theme',
            artists: artistsArr.map((a) => (typeof a?.name === 'string' ? a.name : '')).filter(Boolean),
            episodes: typeof firstEntry.episodes === 'string' && firstEntry.episodes ? firstEntry.episodes : null,
            videoUrl: typeof firstVideo.link === 'string' ? firstVideo.link : null,
          }
        })
        return NextResponse.json({ themes })
      }
    }
  } catch {
    // Fall through to Jikan
  }

  // 2. Fallback: Fetch exact MAL ID from AniList GraphQL, then query Jikan /themes
  try {
    const gqlRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: 'query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }',
        variables: { id: Number(id) },
      }),
      cache: 'no-store',
    })

    let malId: number | null = null
    if (gqlRes.ok) {
      const gqlJson = await gqlRes.json()
      malId = gqlJson?.data?.Media?.idMal ?? null
    }

    if (!malId && title) {
      const searchRes = await fetchWithTimeout(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
        4500,
      )
      if (searchRes.ok) {
        const searchJson = await searchRes.json()
        malId = searchJson?.data?.[0]?.mal_id ?? null
      }
    }

    if (malId) {
      const themesRes = await fetchWithTimeout(`https://api.jikan.moe/v4/anime/${malId}/themes`, 5000)
      if (themesRes.ok) {
        const themesJson = await themesRes.json()
        const ops: string[] = Array.isArray(themesJson?.data?.openings) ? themesJson.data.openings : []
        const eds: string[] = Array.isArray(themesJson?.data?.endings) ? themesJson.data.endings : []
        return NextResponse.json({
          themes: [
            ...ops.map((raw, idx) => parseJikanTheme(raw, 'OP', idx)),
            ...eds.map((raw, idx) => parseJikanTheme(raw, 'ED', idx)),
          ],
        })
      }
    }
  } catch {
    // Return empty gracefully
  }

  return NextResponse.json({ themes: [] })
}
