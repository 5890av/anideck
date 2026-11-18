'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import { anilist } from '@/lib/anilist'
import { startAniListSync } from '@/lib/anilist-account'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => startAniListSync(), [])

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
