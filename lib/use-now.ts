'use client'

import { useSyncExternalStore } from 'react'

let now = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot() {
  if (!now) now = Date.now()
  return now
}

/** Shared one-second clock in milliseconds. Returns 0 during server rendering. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return 'now'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}
