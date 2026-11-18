import type { Metadata } from 'next'
import { WatchlistView } from '@/components/watchlist-view'

export const metadata: Metadata = { title: 'My Watchlist' }

export default function Page() {
  return <WatchlistView />
}
