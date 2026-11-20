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

function decodeHtml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMalHtmlThemes(html: string): ThemeItem[] {
  const results: ThemeItem[] = []

  const extractBlock = (blockRegex: RegExp, type: 'OP' | 'ED') => {
    const blockMatch = html.match(blockRegex)
    if (!blockMatch) return
    const blockHtml = blockMatch[1]

    // Match each table row inside the theme-songs block
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch: RegExpExecArray | null
    let idx = 0

    while ((rowMatch = rowRegex.exec(blockHtml)) !== null) {
      const rowText = decodeHtml(rowMatch[1])
      if (!rowText) continue

      // Strip leading index like "1:" or "S1:"
      const cleaned = rowText.replace(/^(?:S?\d+:)\s*/i, '').trim()
      if (!cleaned) continue

      // Extract trailing "(eps 1-12)" if present
      const epMatch = cleaned.match(/\(([^)]+)\)\s*$/)
      const episodes = epMatch ? epMatch[1].replace(/^eps?\s*/i, '').trim() : null
      const withoutEp = epMatch ? cleaned.slice(0, epMatch.index).trim() : cleaned

      // Extract `"Song Title" by Artist`
      const titleMatch = withoutEp.match(/^"([^"]+)"\s*(?:by\s*(.+))?$/i)
      if (titleMatch) {
        results.push({
          id: `mal-${type}-${idx}`,
          type,
          slug: `${type}${idx + 1}`,
          songTitle: titleMatch[1].trim(),
          artists: titleMatch[2] ? [titleMatch[2].trim()] : [],
          episodes,
          videoUrl: null,
        })
        idx++
      } else if (withoutEp.length > 1) {
        results.push({
          id: `mal-${type}-${idx}`,
          type,
          slug: `${type}${idx + 1}`,
          songTitle: withoutEp,
          artists: [],
          episodes,
          videoUrl: null,
        })
        idx++
      }
    }
  }

  extractBlock(/class="theme-songs\s+js-theme-songs\s+opn"[\s\S]*?(<table[\s\S]*?<\/table>)/i, 'OP')
  extractBlock(/class="theme-songs\s+js-theme-songs\s+ed"[\s\S]*?(<table[\s\S]*?<\/table>)/i, 'ED')

  return results
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim()
  const year = searchParams.get('year')

  if (!title) {
    return NextResponse.json({ themes: [], error: 'Missing title' })
  }

  try {
    // 1. Resolve exact idMal from AniList GraphQL by title
    const gqlRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: 'query ($search: String) { Media(search: $search, type: ANIME) { idMal } }',
        variables: { search: title },
      }),
      cache: 'no-store',
    })

    const gqlJson = gqlRes.ok ? await gqlRes.json() : null
    const malId: number | null = gqlJson?.data?.Media?.idMal ?? null

    // 2. Fetch directly from MyAnimeList's official anime page
    if (malId) {
      const malRes = await fetch(`https://myanimelist.net/anime/${malId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      })

      if (malRes.ok) {
        const html = await malRes.text()
        const themes = parseMalHtmlThemes(html)
        if (themes.length > 0) {
          return NextResponse.json({ themes, malId })
        }
      }
    }

    // 3. Secondary fallback: AnimeThemes API (when online)
    const atUrl = `https://api.animethemes.moe/anime?q=${encodeURIComponent(title)}&page[size]=5&include=animethemes.song.artists,animethemes.animethemeentries.videos`
    const atRes = await fetch(atUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'Anideck/1.0' },
      cache: 'no-store',
    })

    if (atRes.ok) {
      const atJson = await atRes.json()
      const candidates: any[] = Array.isArray(atJson?.anime) ? atJson.anime : []
      const bestMatch =
        (year ? candidates.find((c) => Number(c?.year) === Number(year)) : null) || candidates[0]
      const rawThemes: any[] = Array.isArray(bestMatch?.animethemes) ? bestMatch.animethemes : []
      const themes = rawThemes.map((t, i) => {
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

      if (themes.length > 0) {
        return NextResponse.json({ themes, malId })
      }
    }

    return NextResponse.json({
      themes: [],
      malId,
      error: malId ? `No themes parsed for MAL #${malId}` : `AnimeThemes HTTP ${atRes.status}`,
    })
  } catch (err: any) {
    return NextResponse.json({ themes: [], error: err?.message || 'Server fetch error' })
  }
}
