'use client'

import { useSyncExternalStore } from 'react'

export function createLocalStore<T>(key: string, fallback: T, parse: (raw: unknown) => T) {
  const listeners = new Set<() => void>()
  let cache: T | null = null

  function get(): T {
    if (cache !== null) return cache
    try {
      const raw = window.localStorage.getItem(key)
      cache = raw ? parse(JSON.parse(raw)) : fallback
    } catch {
      cache = fallback
    }
    return cache
  }

  function set(next: T) {
    cache = next
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Storage full or unavailable; keep the in-memory copy so the UI still works.
    }
    listeners.forEach((l) => l())
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
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

  function useValue() {
    return useSyncExternalStore(subscribe, get, () => fallback)
  }

  return { get, set, subscribe, useValue }
}
