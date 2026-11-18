'use client'

import type { MediaCard } from './anilist'
import { logActivity } from './activity'
import { createLocalStore } from './local-store'

export type WatchStatus = 'WATCHING' | 'PLANNING' | 'COMPLETED' | 'PAUSED' | 'DROPPED'

export const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'WATCHING', label: 'Watching' },
  { value: 'PLANNING', label: 'Plan to watch' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DROPPED', label: 'Dropped' },
]

export function statusLabel(status: WatchStatus) {
  return WATCH_STATUSES.find((s) => s.value === status)?.label ?? status
}

export type WatchEntry = {
  id: number
  title: string
  coverImage: string | null
  format: string | null
  episodes: number | null
  genres: string[]
  averageScore: number | null
  status: WatchStatus
  progress: number
  score: number | null
  remoteId: number | null
  addedAt: number
  updatedAt: number
}

export type WatchlistChange = { type: 'save'; entry: WatchEntry } | { type: 'delete'; entry: WatchEntry }

const EMPTY: WatchEntry[] = []
const changeListeners = new Set<(change: WatchlistChange) => void>()

const store = createLocalStore<WatchEntry[]>('anideck:watchlist:v1', EMPTY, (raw) =>
  Array.isArray(raw) ? raw.filter(isEntry).map(normalize) : EMPTY,
)

const read = store.get
const write = store.set

function emit(change: WatchlistChange) {
  changeListeners.forEach((l) => l(change))
}

export function onWatchlistChange(listener: (change: WatchlistChange) => void) {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

function isEntry(value: unknown): value is WatchEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'number' && typeof v.title === 'string' && typeof v.status === 'string'
}

export function normalizeScore(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(10, Math.max(1, Math.round(n * 2) / 2))
}

function normalize(value: WatchEntry): WatchEntry {
  const episodes = typeof value.episodes === 'number' && value.episodes > 0 ? value.episodes : null
  const progress = Math.max(0, Math.floor(Number(value.progress) || 0))
  const status = WATCH_STATUSES.some((s) => s.value === value.status) ? value.status : 'PLANNING'
  return {
    id: value.id,
    title: String(value.title).slice(0, 300),
    coverImage: typeof value.coverImage === 'string' ? value.coverImage : null,
    format: typeof value.format === 'string' ? value.format : null,
    episodes,
    genres: Array.isArray(value.genres) ? value.genres.filter((g) => typeof g === 'string').slice(0, 20) : [],
    averageScore: typeof value.averageScore === 'number' ? value.averageScore : null,
    status,
    progress: episodes ? Math.min(progress, episodes) : progress,
    score: normalizeScore(value.score),
    remoteId: typeof value.remoteId === 'number' ? value.remoteId : null,
    addedAt: Number(value.addedAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
  }
}

export function entryFromMedia(
  media: MediaCard,
  patch: Partial<Pick<WatchEntry, 'status' | 'progress' | 'score' | 'remoteId' | 'updatedAt'>> = {},
): WatchEntry {
  const now = Date.now()
  return normalize({
    id: media.id,
    title: media.title.english || media.title.romaji || 'Untitled',
    coverImage: media.coverImage.large,
    format: media.format,
    episodes: media.episodes,
    genres: media.genres ?? [],
    averageScore: media.averageScore,
    status: 'PLANNING',
    progress: 0,
    score: null,
    remoteId: null,
    addedAt: now,
    updatedAt: now,
    ...patch,
  })
}

export const useWatchlist = store.useValue

export function useWatchEntry(id: number) {
  return useWatchlist().find((e) => e.id === id) ?? null
}

export function getWatchEntry(id: number) {
  return read().find((e) => e.id === id) ?? null
}

export function addToWatchlist(media: MediaCard, status: WatchStatus = 'PLANNING') {
  const list = read()
  if (list.some((e) => e.id === media.id)) return
  const entry = entryFromMedia(media, { status })
  write([entry, ...list])
  logActivity({
    type: 'ADDED',
    mediaId: entry.id,
    title: entry.title,
    coverImage: entry.coverImage,
    detail: `Added to ${statusLabel(status)}`,
  })
  emit({ type: 'save', entry })
}

export function updateEntry(id: number, patch: Partial<Omit<WatchEntry, 'id'>>) {
  const prev = getWatchEntry(id)
  if (!prev) return
  const next = normalize({ ...prev, ...patch, updatedAt: Date.now() })
  write(read().map((e) => (e.id === id ? next : e)))

  const base = { mediaId: id, title: next.title, coverImage: next.coverImage }
  if (next.status !== prev.status) {
    logActivity({ ...base, type: 'STATUS', detail: `${statusLabel(prev.status)} → ${statusLabel(next.status)}` })
  }
  if (next.progress !== prev.progress) {
    logActivity({
      ...base,
      type: 'PROGRESS',
      detail: `Watched episode ${next.progress}${next.episodes ? ` of ${next.episodes}` : ''}`,
    })
  }
  if (next.score !== prev.score) {
    logActivity({
      ...base,
      type: 'SCORE',
      detail: next.score == null ? 'Cleared score' : `Rated ${next.score} / 10`,
    })
  }
  emit({ type: 'save', entry: next })
}

export function setRemoteId(id: number, remoteId: number | null) {
  write(read().map((e) => (e.id === id ? { ...e, remoteId } : e)))
}

export function removeFromWatchlist(id: number) {
  const entry = getWatchEntry(id)
  if (!entry) return
  write(read().filter((e) => e.id !== id))
  logActivity({
    type: 'REMOVED',
    mediaId: id,
    title: entry.title,
    coverImage: entry.coverImage,
    detail: 'Removed from watchlist',
  })
  emit({ type: 'delete', entry })
}

export function incrementProgress(id: number) {
  const entry = getWatchEntry(id)
  if (!entry) return
  if (entry.episodes && entry.progress >= entry.episodes) return
  const progress = entry.progress + 1
  const finished = entry.episodes !== null && progress >= entry.episodes
  updateEntry(id, {
    progress,
    status: finished ? 'COMPLETED' : entry.status === 'COMPLETED' ? 'COMPLETED' : 'WATCHING',
  })
}

/** Bulk merge without emitting sync events; used for backups and AniList imports. */
export function mergeEntries(entries: WatchEntry[], source: string, mode: 'overwrite' | 'newer' = 'overwrite') {
  const byId = new Map(read().map((e) => [e.id, e]))
  let changed = 0
  for (const incoming of entries.map(normalize)) {
    const existing = byId.get(incoming.id)
    if (!existing || mode === 'overwrite' || incoming.updatedAt > existing.updatedAt) {
      byId.set(incoming.id, existing ? { ...incoming, addedAt: existing.addedAt } : incoming)
      changed++
    } else if (incoming.remoteId && !existing.remoteId) {
      byId.set(incoming.id, { ...existing, remoteId: incoming.remoteId })
    }
  }
  write(Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt))
  logActivity({
    type: 'IMPORTED',
    mediaId: null,
    title: source,
    coverImage: null,
    detail: `Imported ${changed} ${changed === 1 ? 'entry' : 'entries'}`,
  })
  return changed
}

export function exportWatchlist() {
  return JSON.stringify({ app: 'anideck', version: 2, exportedAt: new Date().toISOString(), entries: read() }, null, 2)
}

export function importWatchlist(text: string): number {
  const parsed = JSON.parse(text)
  const raw: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null
  if (!raw) throw new Error('This file does not look like an Anideck backup.')
  const imported = raw.filter(isEntry)
  if (imported.length === 0) throw new Error('No valid watchlist entries were found in this file.')
  return mergeEntries(imported, 'Backup file')
}

export function getAllEntries() {
  return read()
}
