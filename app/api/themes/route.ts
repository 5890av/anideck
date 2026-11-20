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

  const extractSection = (startRegex: RegExp, endMarkers: string[], type: 'OP' | 'ED') => {
    const startMatch = startRegex.exec(html)
    if (!startMatch) return

    const contentStart = startMatch.index + startMatch[0].length
    let endIdx = html.length
    for (const marker of endMarkers) {
      const found = html.indexOf(marker, contentStart)
      if (found !== -1 && found < endIdx) endIdx = found
    }
    const section = html.slice(contentStart, endIdx)

    // 1. Modern MAL markup: <span class="theme-song-title"> & <span class="theme-song-artist">
    const songTitleRegex = /class="theme-song-title"[^>]*>([\s\S]*?)<\/span>/gi
    const artistRegex = /class="theme-song-artist"[^>]*>([\s\S]*?)<\/span>/gi
    const epRegex = /class="theme-song-episode"[^>]*>([\s\S]*?)<\/span>/gi

    const titles: string[] = []
    const artists: string[] = []
    const eps: string[] = []
    let m: RegExpExecArray | null

    while ((m = songTitleRegex.exec(section)) !== null) titles.push(decodeHtml(m[1]))
    while ((m = artistRegex.exec(section)) !== null) {
      artists.push(decodeHtml(m[1]).replace(/^by\s+/i, '').trim())
    }
    while ((m = epRegex.exec(section)) !== null) {
      eps.push(decodeHtml(m[1]).replace(/^\(|\)$/g, '').replace(/^eps?\s*/i, '').trim())
    }

    if (titles.length > 0) {
      titles.forEach((rawTitle, idx) => {
        const cleanTitle = rawTitle.replace(/^"|"$/g, '').trim()
        if (!cleanTitle) return
        results.push({
          id: `mal-${type}-${idx}`,
          type,
          slug: `${type}${idx + 1}`,
          songTitle: cleanTitle,
          artists: artists[idx] ? [artists[idx]] : [],
          episodes: eps[idx] || null,
          videoUrl: null,
        })
      })
      return
    }

    // 2. Fallback row parser (<tr> or <li>)
    const rowRegex = /<(?:tr|li)[^>]*>([\s\S]*?)<\/(?:tr|li)>/gi
    let idx = 0
    while ((m = rowRegex.exec(section)) !== null) {
      const rowText = decodeHtml(m[1]).replace(/^(?:S?\d+:)\s*/i, '').trim()
      if (!rowText || rowText.length < 3) continue
      const epMatch = rowText.match(/\(([^)]+)\)\s*$/)
      const episodes = epMatch ? epMatch[1].replace(/^eps?\s*/i, '').trim() : null
      const withoutEp = epMatch ? rowText.slice(0, epMatch.index).trim() : rowText
      const titleMatch = withoutEp.match(/^"([^"]+)"\s*(?:by\s*(.+))?$/i)

      results.push({
        id: `mal-${type}-${idx}`,
        type,
        slug: `${type}${idx + 1}`,
        songTitle: titleMatch ? titleMatch[1].trim() : withoutEp,
        artists: titleMatch?.[2] ? [titleMatch[2].trim()] : [],
        episodes,
        videoUrl: null,
      })
      idx++
    }
  }

  extractSection(/class="[^"]*js-theme-songs[^"]*opn[^"]*"/i, ['js-theme-songs', 'Ending Theme', '<h2>'], 'OP')
  extractSection(/class="[^"]*js-theme-songs[^"]*ed[^"]*"/i, ['<h2>', 'detail-characters-list', 'class="border_top'], 'ED')

  return results
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim()

  if (!title) {
    return NextResponse.json({ themes: [], error: 'Missing title' })
  }

  try {
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

    if (!malId) {
      return NextResponse.json({ themes: [], error: 'No MAL ID found' })
    }

    const malRes = await fetch(`https://myanimelist.net/anime/${malId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })

    if (!malRes.ok) {
      return NextResponse.json({ themes: [], malId, error: `MAL HTTP ${malRes.status}` })
    }

    const html = await malRes.text()
    const themes = parseMalHtmlThemes(html)

    return NextResponse.json({
      themes,
      malId,
      error: themes.length === 0 ? `No themes parsed for MAL #${malId}` : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ themes: [], error: err?.message || 'Server fetch error' })
  }
}
