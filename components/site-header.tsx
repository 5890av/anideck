'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, CalendarDays, Home, Layers, ListChecks, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWatchlist } from '@/lib/watchlist'
import { ConnectAniListButton } from './connect-anilist'

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/watchlist', label: 'My Watchlist', icon: ListChecks },
]

export function SiteHeader() {
  const pathname = usePathname()
  const count = useWatchlist().length

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="size-4" aria-hidden="true" />
          </span>
          <span className="text-lg">Anideck</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  active && 'bg-accent text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{label}</span>
                {href === '/watchlist' && count > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <ConnectAniListButton />
      </div>
    </header>
  )
}
