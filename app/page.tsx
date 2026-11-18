import { Suspense } from 'react'
import { HomeView } from '@/components/home-view'

export default function Page() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  )
}
