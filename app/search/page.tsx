import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchView } from '@/components/search-view'

export const metadata: Metadata = { title: 'Search' }

export default function Page() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  )
}
