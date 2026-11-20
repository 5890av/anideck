import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim()
  const year = searchParams.get('year')

  if (!title) {
    return NextResponse.json({ themes: [], error: 'Missing title' })
  }

  try {
    const url = `https://api.animethemes.moe/anime?q=${encodeURIComponent(title)}&page[size]=5&include=animethemes.song.artists,animethemes.animethemeentries.videos`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Anideck/1.0',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ themes: [], error: `AnimeThemes HTTP ${res.status}` })
    }

    const json = await res.json()
    const candidates: any[] = Array.isArray(json?.anime) ? json.anime : []
    if (candidates.length === 0) {
      return NextResponse.json({ themes: [], error: `No match for "${title}"` })
    }

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

    return NextResponse.json({ themes })
  } catch (err: any) {
    return NextResponse.json({ themes: [], error: err?.message || 'Server fetch error' })
  }
}
