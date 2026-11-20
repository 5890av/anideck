import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'
import { Providers } from '@/components/providers'
import './globals.css'

const Analytics = () => null

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: {
    default: 'Anideck — Discover, track & schedule anime',
    template: '%s · Anideck',
  },
  description:
    'Browse trending anime, filter by genre, follow live airing countdowns, explore characters and staff, and track your watchlist — powered by AniList.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0E1015',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="relative min-h-dvh bg-[#0E1015] text-foreground antialiased selection:bg-[#FF6B4A]/30 selection:text-white">
        <div className="bg-ambient-red" aria-hidden="true" />
        <Providers>
          <SiteHeader />
          <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-28 pt-5 md:px-6 md:pb-16">
            {children}
          </main>
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
