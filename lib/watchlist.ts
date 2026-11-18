'use client'

import { useSyncExternalStore } from 'react'
import type { MediaCard } from './anilist'

export type WatchStatus = 'WATCHING' | 'PLANNING' | 'COMPLETED' | 'PAUSED' | 'DROPPED'

export const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'WATCHING', label: 'Watching' },
  { value: 'PLANNING', label: 'Plan to watch' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DROPPED', label: 'Dropped' },
]

export type WatchEntry = {
  id: number
  title: string
  coverImage: string | null
  format: string | null
  episodes: number | null
  genres: string[]
  status: WatchStatus
  progress: number
  score: number | null
  addedAt: number
  updatedAt: number
}

const STORAGE_KEY = 'anideck:watchlist:v1'
const EMPTY: WatchEntry[] = []
const listeners = new Set<() => void>()
let cache: WatchEntry[] | null = null

function read(): WatchEntry[] {
  if (cache) return cache
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: WatchEntry[]) {
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or unavailable; keep the in-memory copy so the UI still works.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function isEntry(value: unknown): value is WatchEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'number' && typeof v.title === 'string' && typeof v.status === 'string'
}

function normalize(value: WatchEntry): WatchEntry {
  const episodes = typeof value.episodes === 'number' && value.episodes > 0 ? value.episodes : null
  const progress = Math.max(0, Math.floor(Number(value.progress) || 0))
  const score = typeof value.score === 'number' && value.score >= 1 && value.score <= 10 ? value.score : null
  const status = WATCH_STATUSES.some((s) => s.value === value.status) ? value.status : 'PLANNING'
  return {
    id: value.id,
    title: String(value.title).slice(0, 300),
    coverImage: typeof value.coverImage === 'string' ? value.coverImage : null,
    format: typeof value.format === 'string' ? value.format : null,
    episodes,
    genres: Array.isArray(value.genres) ? value.genres.filter((g) => typeof g === 'string').slice(0, 20) : [],
    status,
    progress: episodes ? Math.min(progress, episodes) : progress,
    score,
    addedAt: Number(value.addedAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
  }
}

export function useWatchlist() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function useWatchEntry(id: number) {
  const list = useWatchlist()
  return list.find((e) => e.id === id) ?? null
}

export function addToWatchlist(media: MediaCard, status: WatchStatus = 'PLANNING') {
  const list = read()
  if (list.some((e) => e.id === media.id)) return
  const now = Date.now()
  write([
    normalize({
      id: media.id,
      title: media.title.english || media.title.romaji || 'Untitled',
      coverImage: media.coverImage.large,
      format: media.format,
      episodes: media.episodes,
      genres: media.genres,
      status,
      progress: 0,
      score: null,
      addedAt: now,
      updatedAt: now,
    }),
    ...list,
  ])
}

export function updateEntry(id: number, patch: Partial<Omit<WatchEntry, 'id'>>) {
  write(read().map((e) => (e.id === id ? normalize({ ...e, ...patch, updatedAt: Date.now() }) : e)))
}

export function removeFromWatchlist(id: number) {
  write(read().filter((e) => e.id !== id))
}

export function incrementProgress(id: number) {
  const entry = read().find((e) => e.id === id)
  if (!entry) return
  if (entry.episodes && entry.progress >= entry.episodes) return
  const progress = entry.progress + 1
  const finished = entry.episodes !== null && progress >= entry.episodes
  updateEntry(id, {
    progress,
    status: finished ? 'COMPLETED' : entry.status === 'COMPLETED' ? 'COMPLETED' : 'WATCHING',
  })
}

export function exportWatchlist() {
  return JSON.stringify({ app: 'anideck', version: 1, exportedAt: new Date().toISOString(), entries: read() }, null, 2)
}

export function importWatchlist(text: string): number {
  const parsed = JSON.parse(text)
  const raw: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null
  if (!raw) throw new Error('This file does not look like an Anideck backup.')
  const imported = raw.filter(isEntry).map(normalize)
  if (imported.length === 0) throw new Error('No valid watchlist entries were found in this file.')
  const byId = new Map(read().map((e) => [e.id, e]))
  imported.forEach((e) => byId.set(e.id, e))
  write(Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt))
  return imported.length
}
