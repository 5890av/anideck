import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anideck — Anime Discovery & Watchlist',
    short_name: 'Anideck',
    description: 'Discover trending anime, play OP/ED themes, follow schedules, and sync your AniList watchlist.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0E1015',
    theme_color: '#0E1015',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
