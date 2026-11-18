import type { Metadata } from 'next'
import { AniListCallback } from '@/components/anilist-callback'

export const metadata: Metadata = { title: 'Connecting AniList — Anideck', robots: { index: false } }

export default function Page() {
  return <AniListCallback />
}
