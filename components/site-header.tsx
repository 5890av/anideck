'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Bookmark, Calendar, Dices, Home, Layers, Search } from 'lucide-react'
import { useWatchlist } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { ConnectAniListButton } from './connect-anilist'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
]

export function SiteHeader() {
  const pathname = usePathname()
  const watchlist = useWatchlist()

  return (
    <>
      <header className="glass-nav sticky top-0 z-40 w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          {/* Left: Crimson Stacked Brand Icon + Wordmark */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 group">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground active-pill transition-transform group-hover:scale-105">
              <Layers className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">Anideck</span>
          </Link>

          {/* Center: Floating Glassmorphic Pill Navigation (Tablet & Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-[#121215]/80 p-1 shadow-xl backdrop-blur-xl"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground active-pill'
                      : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.href === '/watchlist' && watchlist.length > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums',
                        isActive ? 'bg-black/25 text-white' : 'bg-primary/20 text-primary',
                      )}
                    >
                      {watchlist.length}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right: Mood Spin Shortcut + Connect AniList */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/roulette"
              aria-label="Anime Mood Roulette"
              title="Mood Spin"
              className={cn(
                'flex size-9 items-center justify-center rounded-xl border transition-colors',
                pathname === '/roulette'
                  ? 'border-primary bg-primary text-primary-foreground active-pill'
                  : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              <Dices className="size-4" aria-hidden="true" />
            </Link>
            <ConnectAniListButton />
          </div>
        </div>
      </header>

      {/* Bottom Floating Glass Dock (Mobile / Compact Portrait) */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center md:hidden">
        <nav
          aria-label="Mobile navigation"
          className="glass-panel flex w-full max-w-md items-center justify-around rounded-2xl px-2 py-2 shadow-2xl"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-2.5 py-1"
              >
                <span
                  className={cn(
                    'flex h-7 w-11 items-center justify-center rounded-xl transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground active-pill'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
