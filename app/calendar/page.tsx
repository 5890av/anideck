import type { Metadata } from 'next'
import { CalendarView } from '@/components/calendar-view'

export const metadata: Metadata = { title: 'Airing Calendar' }

export default function Page() {
  return <CalendarView />
}
