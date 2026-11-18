export const ANILIST_URL = 'https://graphql.anilist.co'

export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'

export type FuzzyDate = { year: number | null; month: number | null; day: number | null }

export type NextAiring = { episode: number; timeUntilAiring: number; airingAt: number } | null

export type MediaCard = {
  id: number
  title: { romaji: string | null; english: string | null }
  coverImage: { large: string | null; color: string | null }
  format: string | null
  episodes: number | null
  status: MediaStatus | null
  averageScore: number | null
  genres: string[]
  seasonYear: number | null
  nextAiringEpisode: NextAiring
}

export type ExternalLink = {
  id: number
  url: string
  site: string
  type: 'INFO' | 'STREAMING' | 'SOCIAL' | null
  icon: string | null
  color: string | null
  language: string | null
}

export type PersonRef = { id: number; name: { full: string }; image: { large: string | null } }

export type MediaDetail = MediaCard & {
  title: MediaCard['title'] & { native: string | null }
  bannerImage: string | null
  description: string | null
  season: string | null
  duration: number | null
  popularity: number | null
  source: string | null
  startDate: FuzzyDate
  studios: { nodes: { id: number; name: string; siteUrl: string | null }[] }
  externalLinks: ExternalLink[]
  characters: {
    edges: { role: string; node: PersonRef; voiceActors: (PersonRef & { languageV2: string | null })[] }[]
  }
  staff: { edges: { role: string; node: PersonRef }[] }
}

export type CharacterDetail = {
  id: number
  name: { full: string; native: string | null; alternative: string[] }
  image: { large: string | null }
  description: string | null
  gender: string | null
  age: string | null
  bloodType: string | null
  dateOfBirth: FuzzyDate
  favourites: number | null
  siteUrl: string | null
  media: {
    edges: {
      characterRole: string
      node: MediaCard
      voiceActors: PersonRef[]
    }[]
  }
}

export type StaffDetail = {
  id: number
  name: { full: string; native: string | null }
  image: { large: string | null }
  description: string | null
  gender: string | null
  age: number | null
  bloodType: string | null
  homeTown: string | null
  languageV2: string | null
  primaryOccupations: string[]
  yearsActive: number[]
  dateOfBirth: FuzzyDate
  dateOfDeath: FuzzyDate
  favourites: number | null
  siteUrl: string | null
  staffMedia: { edges: { staffRole: string; node: MediaCard }[] }
  characterMedia: {
    edges: {
      characterRole: string
      node: MediaCard
      characters: { id: number; name: { full: string }; image: { medium: string | null } }[]
    }[]
  }
}

export type AiringSchedule = {
  id: number
  airingAt: number
  episode: number
  timeUntilAiring: number
  media: MediaCard & { isAdult: boolean }
}

const MEDIA_CARD = `
  id
  title { romaji english }
  coverImage { large color }
  format
  episodes
  status
  averageScore
  genres
  seasonYear
  nextAiringEpisode { episode timeUntilAiring airingAt }
`

export const HOME_QUERY = `
  query Home {
    trending: Page(perPage: 12) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_CARD} }
    }
    airing: Page(perPage: 12) {
      media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_CARD} }
    }
    upcoming: Page(perPage: 12) {
      media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_CARD} }
    }
  }
`

export const GENRES_QUERY = `query Genres { GenreCollection }`

export const SEARCH_QUERY = `
  query Search($search: String, $genre: String, $sort: [MediaSort], $page: Int) {
    Page(page: $page, perPage: 30) {
      pageInfo { hasNextPage }
      media(type: ANIME, search: $search, genre: $genre, sort: $sort, isAdult: false) { ${MEDIA_CARD} }
    }
  }
`

export const MEDIA_DETAIL_QUERY = `
  query Media($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_CARD}
      title { romaji english native }
      bannerImage
      description(asHtml: false)
      season
      duration
      popularity
      source
      startDate { year month day }
      studios(isMain: true) { nodes { id name siteUrl } }
      externalLinks { id url site type icon color language }
      characters(sort: [ROLE, RELEVANCE, ID], perPage: 18) {
        edges {
          role
          node { id name { full } image { large } }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } image { large } languageV2 }
        }
      }
      staff(sort: [RELEVANCE, ID], perPage: 18) {
        edges { role node { id name { full } image { large } } }
      }
    }
  }
`

export const CHARACTER_QUERY = `
  query Character($id: Int) {
    Character(id: $id) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      gender
      age
      bloodType
      dateOfBirth { year month day }
      favourites
      siteUrl
      media(type: ANIME, sort: [POPULARITY_DESC], perPage: 24) {
        edges {
          characterRole
          node { ${MEDIA_CARD} }
          voiceActors(language: JAPANESE) { id name { full } image { large } }
        }
      }
    }
  }
`

export const STAFF_QUERY = `
  query Staff($id: Int) {
    Staff(id: $id) {
      id
      name { full native }
      image { large }
      description(asHtml: false)
      gender
      age
      bloodType
      homeTown
      languageV2
      primaryOccupations
      yearsActive
      dateOfBirth { year month day }
      dateOfDeath { year month day }
      favourites
      siteUrl
      staffMedia(type: ANIME, sort: [POPULARITY_DESC], perPage: 24) {
        edges { staffRole node { ${MEDIA_CARD} } }
      }
      characterMedia(sort: [POPULARITY_DESC], perPage: 24) {
        edges {
          characterRole
          node { ${MEDIA_CARD} }
          characters { id name { full } image { medium } }
        }
      }
    }
  }
`

export const AIRING_QUERY = `
  query Airing($start: Int, $end: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        airingAt
        episode
        timeUntilAiring
        media { ${MEDIA_CARD} isAdult }
      }
    }
  }
`

export async function anilist<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    const message = json?.errors?.[0]?.message ?? `AniList request failed (${res.status})`
    throw new Error(res.status === 429 ? 'AniList rate limit reached. Please wait a minute and retry.' : message)
  }
  return json.data as T
}

export async function fetchWeekAiring(start: number, end: number): Promise<AiringSchedule[]> {
  const all: AiringSchedule[] = []
  for (let page = 1; page <= 8; page++) {
    const data = await anilist<{
      Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AiringSchedule[] }
    }>(AIRING_QUERY, { start, end, page })
    all.push(...data.Page.airingSchedules)
    if (!data.Page.pageInfo.hasNextPage) break
  }
  return all.filter((s) => s.media && !s.media.isAdult)
}

export function displayTitle(title: { romaji: string | null; english: string | null }) {
  return title.english || title.romaji || 'Untitled'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatFuzzyDate(date: FuzzyDate | null | undefined) {
  if (!date || (!date.year && !date.month && !date.day)) return null
  const parts: string[] = []
  if (date.month) parts.push(MONTHS[date.month - 1])
  if (date.day) parts.push(String(date.day))
  const md = parts.join(' ')
  if (date.year) return md ? `${md}, ${date.year}` : String(date.year)
  return md
}

export function formatEnum(value: string | null | undefined) {
  if (!value) return null
  if (value === 'TV_SHORT') return 'TV Short'
  if (['TV', 'OVA', 'ONA'].includes(value)) return value
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
