'use client'

import { createLocalStore } from './local-store'

export type ActivityType = 'ADDED' | 'PROGRESS' | 'STATUS' | 'SCORE' | 'REMOVED' | 'IMPORTED'

export type ActivityEntry = {
  id: string
  type: ActivityType
  mediaId: number | null
  title: string
  coverImage: string | null
  detail: string
  at: number
}

const MAX_ENTRIES = 300
const EMPTY: ActivityEntry[] = []

const store = createLocalStore<ActivityEntry[]>('anideck:activity:v1', EMPTY, (raw) =>
  Array.isArray(raw)
    ? raw.filter(
        (a): a is ActivityEntry =>
          !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.at === 'number',
      )
    : EMPTY,
)

export const useActivityLog = store.useValue

export function logActivity(entry: Omit<ActivityEntry, 'id' | 'at'>) {
  const item: ActivityEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  }
  store.set([item, ...store.get()].slice(0, MAX_ENTRIES))
}

export function clearActivityLog() {
  store.set(EMPTY)
}
