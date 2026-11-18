'use client'

import {
  anilist,
  AniListError,
  DELETE_ENTRY_MUTATION,
  LIST_COLLECTION_QUERY,
  SAVE_ENTRY_MUTATION,
  VIEWER_QUERY,
  type AniListListStatus,
  type RemoteListEntry,
  type Viewer,
} from './anilist'
import { createLocalStore } from './local-store'
import {
  entryFromMedia,
  getAllEntries,
  getWatchEntry,
  mergeEntries,
  onWatchlistChange,
  setRemoteId,
  type WatchEntry,
  type WatchStatus,
} from './watchlist'

export type SyncState = 'idle' | 'syncing' | 'error'

export type AniListAccount = {
  clientId: string
  token: string | null
  tokenExpiresAt: number | null
  viewer: Viewer | null
  lastImportedUser: string | null
  lastSyncAt: number | null
  syncState: SyncState
  syncError: string | null
}

const DEFAULT: AniListAccount = {
  clientId: '',
  token: null,
  tokenExpiresAt: null,
  viewer: null,
  lastImportedUser: null,
  lastSyncAt: null,
  syncState: 'idle',
  syncError: null,
}

const store = createLocalStore<AniListAccount>('anideck:anilist:v1', DEFAULT, (raw) =>
  raw && typeof raw === 'object' ? { ...DEFAULT, ...(raw as Partial<AniListAccount>), syncState: 'idle' } : DEFAULT,
)

export const useAniListAccount = store.useValue

function patch(next: Partial<AniListAccount>) {
  store.set({ ...store.get(), ...next })
}

export function setClientId(clientId: string) {
  patch({ clientId: clientId.trim() })
}

export function getValidToken() {
  const { token, tokenExpiresAt } = store.get()
  if (!token) return null
  if (tokenExpiresAt && tokenExpiresAt < Date.now()) {
    patch({ token: null, viewer: null, tokenExpiresAt: null, syncError: 'Your AniList session expired. Log in again.' })
    return null
  }
  return token
}

export function authorizeUrl(clientId: string) {
  return `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token`
}

export function startOAuthLogin(clientId: string) {
  setClientId(clientId)
  const url = authorizeUrl(clientId.trim())
  // AniList refuses to render inside iframes, so open a popup when embedded (e.g. the v0 preview).
  if (window.self !== window.top) {
    window.open(url, 'anilist-oauth', 'width=520,height=720')
  } else {
    window.location.assign(url)
  }
}

export function parseOAuthHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const token = params.get('access_token')
  const expiresIn = Number(params.get('expires_in'))
  return token ? { token, expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null } : null
}

export async function completeOAuthLogin(token: string, expiresAt: number | null) {
  const { Viewer } = await anilist<{ Viewer: Viewer }>(VIEWER_QUERY, {}, token)
  patch({ token, tokenExpiresAt: expiresAt, viewer: Viewer, syncError: null })
  await pullViewerList()
  return Viewer
}

export function logout() {
  patch({ token: null, tokenExpiresAt: null, viewer: null, syncState: 'idle', syncError: null })
}

const TO_REMOTE: Record<WatchStatus, AniListListStatus> = {
  WATCHING: 'CURRENT',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  DROPPED: 'DROPPED',
}

function fromRemote(status: AniListListStatus): WatchStatus {
  if (status === 'CURRENT' || status === 'REPEATING') return 'WATCHING'
  return status
}

function remoteToLocal(entries: RemoteListEntry[]): WatchEntry[] {
  return entries
    .filter((e) => e.media && !(e.media as { isAdult?: boolean }).isAdult)
    .map((e) =>
      entryFromMedia(e.media, {
        status: fromRemote(e.status),
        progress: e.progress ?? 0,
        score: e.score,
        remoteId: e.id,
        updatedAt: e.updatedAt ? e.updatedAt * 1000 : Date.now(),
      }),
    )
}

type CollectionResponse = {
  MediaListCollection: { user: { name: string }; lists: { entries: RemoteListEntry[] }[] } | null
}

async function fetchCollection(vars: { userName?: string; userId?: number }, token?: string | null) {
  const data = await anilist<CollectionResponse>(LIST_COLLECTION_QUERY, vars, token)
  const collection = data.MediaListCollection
  if (!collection) throw new Error('No anime list was found for this user.')
  const seen = new Map<number, RemoteListEntry>()
  collection.lists.flatMap((l) => l.entries).forEach((e) => seen.set(e.media.id, e))
  return { userName: collection.user.name, entries: Array.from(seen.values()) }
}

export async function importByUsername(userName: string) {
  const name = userName.trim()
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(name)) throw new Error('Enter a valid AniList username.')
  try {
    const { userName: resolved, entries } = await fetchCollection({ userName: name })
    // Entries belong to another account, so drop their remote IDs to avoid editing someone else's list.
    const local = remoteToLocal(entries).map((e) => ({ ...e, remoteId: null }))
    const count = mergeEntries(local, `AniList: ${resolved}`)
    patch({ lastImportedUser: resolved })
    return { userName: resolved, count }
  } catch (err) {
    if (err instanceof AniListError && err.status === 404) {
      throw new Error('That user does not exist or their list is private.')
    }
    throw err
  }
}

export async function pullViewerList() {
  const token = getValidToken()
  const viewer = store.get().viewer
  if (!token || !viewer) return 0
  patch({ syncState: 'syncing', syncError: null })
  try {
    const { entries } = await fetchCollection({ userId: viewer.id }, token)
    const count = mergeEntries(remoteToLocal(entries), `AniList: ${viewer.name}`, 'newer')
    patch({ syncState: 'idle', lastSyncAt: Date.now() })
    return count
  } catch (err) {
    patch({ syncState: 'error', syncError: err instanceof Error ? err.message : 'Sync failed.' })
    throw err
  }
}

async function pushEntry(entry: WatchEntry, token: string) {
  const data = await anilist<{ SaveMediaListEntry: { id: number } }>(
    SAVE_ENTRY_MUTATION,
    {
      mediaId: entry.id,
      status: TO_REMOTE[entry.status],
      // scoreRaw is always on a 0–100 scale, so 8.5 maps correctly regardless of the account's score format.
      scoreRaw: entry.score ? Math.round(entry.score * 10) : 0,
      progress: entry.progress,
    },
    token,
  )
  if (getWatchEntry(entry.id)) setRemoteId(entry.id, data.SaveMediaListEntry.id)
}

async function deleteEntry(entry: WatchEntry, token: string) {
  if (!entry.remoteId) return
  await anilist(DELETE_ENTRY_MUTATION, { id: entry.remoteId }, token)
}

const pending = new Map<number, ReturnType<typeof setTimeout>>()

async function runSync(task: () => Promise<void>) {
  patch({ syncState: 'syncing', syncError: null })
  try {
    await task()
    patch({ syncState: 'idle', lastSyncAt: Date.now() })
  } catch (err) {
    patch({ syncState: 'error', syncError: err instanceof Error ? err.message : 'AniList sync failed.' })
  }
}

/** Mirror local watchlist edits to the logged-in AniList account, debounced per title. */
export function startAniListSync() {
  return onWatchlistChange((change) => {
    const token = getValidToken()
    if (!token || !store.get().viewer) return
    const id = change.entry.id
    clearTimeout(pending.get(id))
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id)
        if (change.type === 'delete') {
          runSync(() => deleteEntry(change.entry, token))
        } else {
          const latest = getWatchEntry(id)
          if (latest) runSync(() => pushEntry(latest, token))
        }
      }, 900),
    )
  })
}

/** Push every local entry that AniList doesn't know about yet, spaced out to respect rate limits. */
export async function pushUnsyncedEntries(onProgress?: (done: number, total: number) => void) {
  const token = getValidToken()
  if (!token) throw new Error('Log in with AniList first.')
  const todo = getAllEntries().filter((e) => !e.remoteId)
  await runSync(async () => {
    for (let i = 0; i < todo.length; i++) {
      await pushEntry(todo[i], token)
      onProgress?.(i + 1, todo.length)
      if (i < todo.length - 1) await new Promise((r) => setTimeout(r, 2100))
    }
  })
  return todo.length
}
