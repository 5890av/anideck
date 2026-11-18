'use client'

import { SWRConfig } from 'swr'
import { anilist } from '@/lib/anilist'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: ([query, variables]: [string, Record<string, unknown>]) => anilist(query, variables),
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
        shouldRetryOnError: false,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
