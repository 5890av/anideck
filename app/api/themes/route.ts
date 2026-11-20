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

  // Strategy A: <span class="theme-song-title"> markup
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

  if (titles.length > 0) {
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

  // Strategy B: Table rows <tr> or list items <li>
  const rowRegex = /<(?:tr|li)[^>]*>([\s\S]*?)<\/(?:tr|li)>/gi
  let idx = 0
  while ((m = rowRegex.exec(section)) !== null) {
    const rawRow = decodeHtml(m[1])
    if (!rawRow || rawRow.length < 3) continue
    if (/^(?:More|Less|Edit)$/i.test(rawRow)) continue

    const cleaned = rawRow.replace(/^(?:S?\d+:)\s*/i, '').trim()
    const epMatch = cleaned.match(/\(([^)]+)\)\s*$/)
    const episodes = epMatch ? epMatch[1].replace(/^eps?\s*/i, '').trim() : null
    const withoutEp = epMatch ? cleaned.slice(0, epMatch.index).trim() : cleaned
    const titleMatch = withoutEp.match(/^"([^"]+)"\s*(?:by\s*(.+))?$/i)

    if (titleMatch || withoutEp.includes('"')) {
      items.push({
        id: `mal-${type}-${idx}`,
        type,
        slug: `${type}${idx + 1}`,
        songTitle: titleMatch ? titleMatch[1].trim() : withoutEp.replace(/^"|"$/g, ''),
        artists: titleMatch?.[2] ? [titleMatch[2].trim()] : [],
        episodes,
        videoUrl: null,
        youtubeId: null,
      })
      idx++
    }
  }

  return items
}

function parseMalHtmlThemes(html: string): ThemeItem[] {
  const results: ThemeItem[] = []

  const opHeadingIdx = html.search(/>Opening Theme\s*</i)
  const edHeadingIdx = html.search(/>Ending Theme\s*</i)

  if (opHeadingIdx !== -1) {
    const opEnd = edHeadingIdx !== -1 && edHeadingIdx > opHeadingIdx ? edHeadingIdx : opHeadingIdx + 60000
    results.push(...parseBlockItems(html.slice(opHeadingIdx, opEnd), 'OP'))
  }

  if (edHeadingIdx !== -1) {
    const afterEd = html.slice(edHeadingIdx, edHeadingIdx + 60000)
    const nextSectionIdx = afterEd.search(/<h2[^>]*>/i)
    const edSection = nextSectionIdx !== -1 ? afterEd.slice(0, nextSectionIdx) : afterEd
    results.push(...parseBlockItems(edSection, 'ED'))
  }

  if (results.length > 0) return results

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

  matches.forEach((entry, i) => {
    const nextStart = matches[i + 1] ? matches[i + 1].index : Math.min(html.length, entry.endOfTag + 60000)
    const section = html.slice(entry.endOfTag, nextStart)
    const isEnding = entry.classes.includes('ed') || entry.classes.includes('ending') || i === 1
    results.push(...parseBlockItems(section, isEnding ? 'ED' : 'OP'))
  })

  return results
}

async function isEmbeddable(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { cache: 'no-store' },
    )
    return res.ok
  } catch {
    return false
  }
}

async function resolveEmbeddableYouTubeId(query: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4500)
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const html = await res.text()
    const matches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g))
    const uniqueIds = Array.from(new Set(matches.map((m) => m[1]))).slice(0, 6)

    for (const vid of uniqueIds) {
      if (await isEmbeddable(vid)) {
        return vid
      }
    }
    return uniqueIds[0] || null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Mode 1: On-demand playable video lookup when user clicks Play on ANY OP/ED
  const playQuery = searchParams.get('playQuery')?.trim()
  if (playQuery) {
    const youtubeId = await resolveEmbeddableYouTubeId(playQuery)
    return NextResponse.json({ youtubeId })
  }

  // Mode 2: Fast full OP/ED list from MyAnimeList
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
