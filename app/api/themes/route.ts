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

async function fetchWithTimeout(url: string, ms = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Anideck/1.0' },
      next: { revalidate: 3600 },
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

  // 1. Try AnimeThemes server-side (no browser CORS block)
  try {
    const atUrl = `https://api.animethemes.moe/anime?filter[has]=resources&filter[site]=anilist&filter[external_id]=${encodeURIComponent(id)}&include=resources,animethemes.song.artists,animethemes.animethemeentries.videos`
    const res = await fetchWithTimeout(atUrl, 5000)
    if (res.ok) {
      const json = await res.json()
      const anime = Array.isArray(json?.anime) ? json.anime[0] : null
      if (Array.isArray(anime?.animethemes) && anime.animethemes.length > 0) {
        const themes: ThemeItem[] = anime.animethemes.map((t: Record<string, unknown>, i: number) => {
          const song = (t.song as Record<string, unknown>) ?? {}
          const artistsArr = Array.isArray(song.artists) ? song.artists : []
          const entries = Array.isArray(t.animethemeentries) ? t.animethemeentries : []
          const firstEntry = (entries[0] as Record<string, unknown>) ?? {}
          const videos = Array.isArray(firstEntry.videos) ? firstEntry.videos : []
          const firstVideo = (videos[0] as Record<string, unknown>) ?? {}

          return {
            id: `at-${t.id ?? i}`,
            type: t.type === 'ED' ? 'ED' : 'OP',
            slug: String(t.slug || t.type || `OP${i + 1}`),
            songTitle: typeof song.title === 'string' && song.title ? song.title : 'Untitled Theme',
            artists: artistsArr
              .map((a: Record<string, unknown>) => (typeof a.name === 'string' ? a.name : ''))
              .filter(Boolean),
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

  // 2. Fallback: Jikan (MyAnimeList)
  if (title) {
    try {
      const searchRes = await fetchWithTimeout(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
        4500,
      )
      if (searchRes.ok) {
        const searchJson = await searchRes.json()
        const malId = searchJson?.data?.[0]?.mal_id
        if (malId) {
          const themesRes = await fetchWithTimeout(`https://api.jikan.moe/v4/anime/${malId}/themes`, 4500)
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
      }
    } catch {
      // Return empty gracefully
    }
  }

  return NextResponse.json({ themes: [] })
}
