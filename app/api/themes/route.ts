import { NextResponse } from 'next/server'

type ThemeItem = {
  id: string
  type: 'OP' | 'ED'
  slug: string
  songTitle: string
  artists: string[]
  episodes: string | null
  videoUrl: string | null
  youtubeId: string | null
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

function parseBlockItems(section: string, type: 'OP' | 'ED'): ThemeItem[] {
  const items: ThemeItem[] = []
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
    eps.push(decodeHtml(m[1]).replace(/^\(\vert{}\)$/g, '').replace(/^eps?\s*/i, '').trim())
  }

  titles.forEach((rawTitle, idx) => {
    const cleanTitle = rawTitle.replace(/^"|"$/g, '').trim()
    if (!cleanTitle) return
    items.push({
      id: `mal-${type}-${idx}`,
      type,
      slug: `${type}${idx + 1}`,
      songTitle: cleanTitle,
      artists: artists[idx] ? [artists[idx]] : [],
      episodes: eps[idx] || null,
      videoUrl: null,
      youtubeId: null,
    })
  })

  return items
}

function parseMalHtmlThemes(html: string): ThemeItem[] {
  const containerRegex = /<div[^>]*class="[^"]*js-theme-songs([^"]*)"[^>]*>/gi
  const matches: { index: number; endOfTag: number; classes: string }[] = []
  let m: RegExpExecArray | null

  while ((m = containerRegex.exec(html)) !== null) {
    matches.push({
      index: m.index,
      endOfTag: m.index + m[0].length,
      classes: m[1].toLowerCase(),
    })
  }

  const results: ThemeItem[] = []
  matches.forEach((entry, i) => {
    const nextStart = matches[i + 1] ? matches[i + 1].index : Math.min(html.length, entry.endOfTag + 25000)
    const section = html.slice(entry.endOfTag, nextStart)
    const isEnding = entry.classes.includes('ed') || entry.classes.includes('ending') || i === 1
    results.push(...parseBlockItems(section, isEnding ? 'ED' : 'OP'))
  })

  return results
}

async function resolveYouTubeId(query: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
    return match ? match[1] : null
  } catch {
    return null
  }
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
        query: 'query ($search: String) { Media(search:$search, type: ANIME) { idMal } }',
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
    const parsedThemes = parseMalHtmlThemes(html)

    // Resolve playable YouTube video IDs in parallel (up to first 12 themes for speed)
    const themes = await Promise.all(
      parsedThemes.map(async (item, idx) => {
        if (idx >= 12) return item
        const query = `${title} ${item.slug} ${item.songTitle} ${item.artists.join(' ')}`.trim()
        const youtubeId = await resolveYouTubeId(query)
        return { ...item, youtubeId }
      }),
    )

    return NextResponse.json({
      themes,
      malId,
      error: themes.length === 0 ? `No themes parsed for MAL #${malId}` : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ themes: [], error: err?.message || 'Server fetch error' })
  }
}
