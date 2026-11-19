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

export type StudioRef = {
  id: number
  name: string
  isAnimationStudio: boolean
  siteUrl: string | null
  favourites: number | null
}

export type Recommendation = {
  rating: number | null
  mediaRecommendation: {
    id: number
    title: { romaji: string | null; english: string | null }
    coverImage: { large: string | null }
    averageScore: number | null
    format: string | null
    episodes: number | null
  } | null
}

export type StudioDetail = StudioRef & {
  media: { pageInfo: { hasNextPage: boolean; total: number | null }; nodes: (MediaCard & { isAdult: boolean })[] }
}

export type ActivityLikeUser = {
  id: number
  name: string
  avatar: { medium: string | null }
}

export type ListActivity = {
  id: number
  status: string | null
  progress: string | null
  createdAt: number
  likeCount: number
  isLiked: boolean | null
  likes?: ActivityLikeUser[]
  user: { id: number; name: string; avatar: { medium: string | null } } | null
  media: {
    id: number
    title: { romaji: string | null; english: string | null }
    coverImage: { medium: string | null }
    format: string | null
  } | null
}

export type AniListListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING'

export type RemoteListEntry = {
  id: number
  status: AniListListStatus
  progress: number | null
  score: number | null
  updatedAt: number | null
  media: MediaCard
}

export type Viewer = {
  id: number
  name: string
  avatar: { medium: string | null }
  siteUrl: string | null
  mediaListOptions: { scoreFormat: string | null } | null
}

export type MediaTag = { id: number; name: string; rank: number; isMediaSpoiler: boolean }

export type MediaReview = {
  id: number
  summary: string
  rating: number
  user: { name: string; avatar: { medium: string | null } }
}

export type MediaDetail = MediaCard & {
  title: MediaCard['title'] & { native: string | null }
  bannerImage: string | null
  description: string | null
  season: string | null
  duration: number | null
  popularity: number | null
  source: string | null
  startDate: FuzzyDate
  studios: { edges: { isMain: boolean; node: StudioRef }[] }
  recommendations: { nodes: Recommendation[] }
  externalLinks: ExternalLink[]
  tags: MediaTag[]
  reviews: { nodes: MediaReview[] }
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
      studios { edges { isMain node { id name isAnimationStudio siteUrl favourites } } }
      recommendations(sort: RATING_DESC, perPage: 10) {
        nodes {
          rating
          mediaRecommendation { id title { romaji english } coverImage { large } averageScore format episodes }
        }
      }
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

export const STUDIO_QUERY = `
  query Studio($id: Int, $page: Int) {
    Studio(id: $id) {
      id
      name
      isAnimationStudio
      siteUrl
      favourites
      media(sort: POPULARITY_DESC, page: $page, perPage: 30) {
        pageInfo { hasNextPage total }
        nodes { ${MEDIA_CARD} isAdult }
      }
    }
  }
`

export const COMMUNITY_ACTIVITY_QUERY = `
  query Activity($page: Int) {
    Page(page: $page, perPage: 25) {
      pageInfo { hasNextPage }
      activities(type: ANIME_LIST, sort: ID_DESC) {
        ... on ListActivity {
          id
          status
          progress
          createdAt
          likeCount
          isLiked
          likes { id name avatar { medium } }
          user { id name avatar { medium } }
          media { id title { romaji english } coverImage { medium } format }
        }
      }
    }
  }
`

export const LIST_COLLECTION_QUERY = `
  query List($userName: String, $userId: Int) {
    MediaListCollection(userName: $userName, userId: $userId, type: ANIME) {
      user { id name avatar { medium } }
      lists {
        entries {
          id
          status
          progress
          score(format: POINT_10_DECIMAL)
          updatedAt
          media { ${MEDIA_CARD} }
        }
      }
    }
  }
`

export const VIEWER_QUERY = `
  query Viewer {
    Viewer { id name avatar { medium } siteUrl mediaListOptions { scoreFormat } }
  }
`

export const SAVE_ENTRY_MUTATION = `
  mutation Save($mediaId: Int, $status: MediaListStatus, $scoreRaw: Int, $progress: Int) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, scoreRaw: $scoreRaw, progress: $progress) {
      id
      status
      progress
      score(format: POINT_10_DECIMAL)
    }
  }
`

export const DELETE_ENTRY_MUTATION = `
  mutation Delete($id: Int) {
    DeleteMediaListEntry(id: $id) { deleted }
  }
`

export class AniListError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function getBrowserToken(): string | null {
  if (typeof window === 'undefined') return null
  const directKeys = ['anilist_token', 'anilist_access_token', 'anideck_anilist_token']
  for (const key of directKeys) {
    const val = window.localStorage.getItem(key)
    if (val && val.length > 20) return val.replace(/^"|"$/g, '')
  }
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    if (raw.startsWith('{') && raw.includes('token')) {
      try {
        const parsed = JSON.parse(raw)
        const token = parsed?.token || parsed?.accessToken || parsed?.access_token
        if (typeof token === 'string' && token.length > 20) return token
      } catch {
        // ignore invalid JSON
      }
    }
  }
  return null
}

export async function anilist<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const authToken = token !== undefined ? token : getBrowserToken()
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  const res = await fetch(ANILIST_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    const message = json?.errors?.[0]?.message ?? `AniList request failed (${res.status})`
    throw new AniListError(
      res.status === 429 ? 'AniList rate limit reached. Please wait a minute and retry.' : message,
      res.status,
    )
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
export type UserProfile = {
  id: number
  name: string
  about: string | null
  avatar: { large: string | null; medium: string | null }
  bannerImage: string | null
  siteUrl: string | null
  createdAt: number | null
  statistics: {
    anime: {
      count: number
      episodesWatched: number
      minutesWatched: number
      meanScore: number
      genres: { genre: string; count: number }[]
    }
  }
  favourites: {
    anime: {
      nodes: {
        id: number
        title: { romaji: string | null; english: string | null }
        coverImage: { large: string | null }
        averageScore: number | null
      }[]
    }
    characters: {
      nodes: {
        id: number
        name: { full: string }
        image: { large: string | null }
      }[]
    }
  }
}

export const USER_PROFILE_QUERY = `
  query UserProfile($name: String) {
    User(name: $name) {
      id
      name
      about(asHtml: false)
      avatar { large medium }
      bannerImage
      siteUrl
      createdAt
      statistics {
        anime {
          count
          episodesWatched
          minutesWatched
          meanScore
          genres(limit: 6, sort: COUNT_DESC) { genre count }
        }
      }
      favourites {
        anime(perPage: 12) {
          nodes {
            id
            title { romaji english }
            coverImage { large }
            averageScore
          }
        }
        characters(perPage: 12) {
          nodes {
            id
            name { full }
            image { large }
          }
        }
      }
    }
  }
`

