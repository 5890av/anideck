import type { Metadata } from 'next'
import { ActivityView } from '@/components/activity-view'

export const metadata: Metadata = {
  title: 'Activity — Anideck',
  description: 'Recent AniList community updates and your own watch history.',
}

export default function Page() {
  return <ActivityView />
}
