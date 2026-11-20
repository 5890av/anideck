'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Sparkles,
  Trophy,
  Wand2,
  X,
} from 'lucide-react'
import { useWatchlist, type WatchEntry } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

type TierId = 'S' | 'A' | 'B' | 'C' | 'D'

type TierConfig = {
  id: TierId
  defaultLabel: string
  accentHex: string
  badgeBg: string
  badgeText: string
}

const TIERS: TierConfig[] = [
  { id: 'S', defaultLabel: 'S · GOAT', accentHex: '#E11D48', badgeBg: 'bg-[#E11D48]', badgeText: 'text-white' },
  { id: 'A', defaultLabel: 'A · Peak', accentHex: '#F97316', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { id: 'B', defaultLabel: 'B · Great', accentHex: '#EAB308', badgeBg: 'bg-amber-400', badgeText: 'text-black' },
  { id: 'C', defaultLabel: 'C · Solid', accentHex: '#10B981', badgeBg: 'bg-emerald-500', badgeText: 'text-white' },
  { id: 'D', defaultLabel: 'D · Mid', accentHex: '#6366F1', badgeBg: 'bg-indigo-500', badgeText: 'text-white' },
]

export default function TierListPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const rawWatchlist = useWatchlist()
  const watchlist = mounted && Array.isArray(rawWatchlist) ? rawWatchlist : []

  const [poolFilter, setPoolFilter] = useState<'COMPLETED' | 'WATCHING' | 'ALL'>('ALL')
  const [assignments, setAssignments] = useState<Record<number, TierId>>({})
  const [labels, setLabels] = useState<Record<TierId, string>>({
    S: 'S · GOAT',
    A: 'A · Peak',
    B: 'B · Great',
    C: 'C · Solid',
    D: 'D · Mid',
  })
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const entryMap = useMemo(() => {
    const m = new Map<number, WatchEntry>()
    watchlist.forEach((e) => m.set(e.id, e))
    return m
  }, [watchlist])

  const tieredEntries = useMemo(() => {
    const grouped: Record<TierId, WatchEntry[]> = { S: [], A: [], B: [], C: [], D: [] }
    for (const [idStr, tier] of Object.entries(assignments)) {
      const entry = entryMap.get(Number(idStr))
      if (entry) grouped[tier].push(entry)
    }
    return grouped
  }, [assignments, entryMap])

  const unrankedPool = useMemo(() => {
    return watchlist
      .filter((e) => !assignments[e.id])
      .filter((e) => (poolFilter === 'ALL' ? true : e.status === poolFilter))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.updatedAt - a.updatedAt)
  }, [watchlist, assignments, poolFilter])

  const assignToTier = (entryId: number, tier: TierId) => {
    setAssignments((prev) => ({ ...prev, [entryId]: tier }))
    setSelectedEntryId(null)
  }

  const removeFromTier = (entryId: number) => {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[entryId]
      return next
    })
  }

  const handleAutoRank = () => {
    const next: Record<number, TierId> = {}
    for (const entry of watchlist) {
      if (entry.score != null) {
        if (entry.score >= 9) next[entry.id] = 'S'
        else if (entry.score >= 8) next[entry.id] = 'A'
        else if (entry.score >= 7) next[entry.id] = 'B'
        else if (entry.score >= 6) next[entry.id] = 'C'
        else next[entry.id] = 'D'
      } else if (entry.averageScore != null) {
        if (entry.averageScore >= 85) next[entry.id] = 'S'
        else if (entry.averageScore >= 78) next[entry.id] = 'A'
        else if (entry.averageScore >= 72) next[entry.id] = 'B'
        else if (entry.averageScore >= 65) next[entry.id] = 'C'
        else next[entry.id] = 'D'
      }
    }
    setAssignments(next)
    setSelectedEntryId(null)
  }

  const handleExportPng = async () => {
    if (exporting) return
    setExporting(true)

    try {
      const width = 1200
      const headerHeight = 96
      const rowPadding = 16
      const cardW = 92
      const cardH = 132
      const gap = 12
      const labelColW = 190
      const contentW = width - labelColW - rowPadding * 3
      const colsPerRow = Math.max(1, Math.floor((contentW + gap) / (cardW + gap)))

      const rowHeights = TIERS.map((t) => {
        const count = tieredEntries[t.id].length
        const rows = Math.max(1, Math.ceil(count / colsPerRow))
        return rows * cardH + (rows - 1) * gap + rowPadding * 2
      })

      const totalHeight = headerHeight + rowHeights.reduce((a, b) => a + b, 0) + 48
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = totalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#09090B'
      ctx.fillRect(0, 0, width, totalHeight)

      const grad = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 0, 600)
      grad.addColorStop(0, 'rgba(225, 29, 72, 0.25)')
      grad.addColorStop(1, 'rgba(9, 9, 11, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, 240)

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif'
      ctx.fillText('ANIDECK · MY ANIME TIER LIST', 32, 54)

      ctx.fillStyle = '#A1A1AA'
      ctx.font = '500 16px system-ui, -apple-system, sans-serif'
      const rankedCount = Object.keys(assignments).length
      ctx.fillText(`${rankedCount} Ranked Titles · Generated on Anideck`, 32, 78)

      const loadImg = (src: string | null): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          if (!src) return resolve(null)
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = src
        })

      let y = headerHeight
      for (let i = 0; i < TIERS.length; i++) {
        const tier = TIERS[i]
        const h = rowHeights[i]
        const items = tieredEntries[tier.id]

        ctx.fillStyle = '#121215'
        ctx.fillRect(24, y, width - 48, h - 8)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.strokeRect(24, y, width - 48, h - 8)

        ctx.fillStyle = tier.accentHex
        ctx.fillRect(24, y, labelColW, h - 8)

        ctx.fillStyle = tier.id === 'B' ? '#09090B' : '#FFFFFF'
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
        ctx.fillText(labels[tier.id] || tier.id, 42, y + (h - 8) / 2 + 8)

        for (let idx = 0; idx < items.length; idx++) {
          const entry = items[idx]
          const r = Math.floor(idx / colsPerRow)
          const c = idx % colsPerRow
          const cx = 24 + labelColW + rowPadding + c * (cardW + gap)
          const cy = y + rowPadding + r * (cardH + gap)

          const img = await loadImg(entry.coverImage)
          if (img) {
            ctx.drawImage(img, cx, cy, cardW, cardH)
          } else {
            ctx.fillStyle = '#27272A'
            ctx.fillRect(cx, cy, cardW, cardH)
            ctx.fillStyle = '#FAFAFA'
            ctx.font = '600 11px system-ui, sans-serif'
            ctx.fillText(entry.title.slice(0, 12), cx + 6, cy + 22)
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'
          ctx.strokeRect(cx, cy, cardW, cardH)
        }

        y += h
      }

      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `anideck-tierlist-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch {
      // Fallback if browser blocks canvas export
    } finally {
      setExporting(false)
    }
  }

  const totalRanked = Object.keys(assignments).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Trophy className="size-7 text-primary" />
            Custom Tier List Builder
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap any anime below, then tap a tier row (S–D) to rank it—or auto-fill from your scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoRank}
            disabled={watchlist.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40"
          >
            <Wand2 className="size-3.5" /> Auto-Rank
          </button>

          {totalRanked > 0 && (
            <button
              type="button"
              onClick={() => {
                setAssignments({})
                setSelectedEntryId(null)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-muted-foreground hover:text-white"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}

          <button
            type="button"
            onClick={handleExportPng}
            disabled={totalRanked === 0 || exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground active-pill transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Download className="size-3.5" />
            {exporting ? 'Rendering...' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* Tier Board */}
      <section className="glass-panel flex flex-col divide-y divide-white/10 overflow-hidden rounded-3xl">
        {TIERS.map((tier) => {
          const items = tieredEntries[tier.id]
          const isDropTarget = selectedEntryId !== null

          return (
            <div
              key={tier.id}
              onClick={() => {
                if (selectedEntryId !== null) assignToTier(selectedEntryId, tier.id)
              }}
              className={cn(
                'flex min-h-[104px] flex-col sm:flex-row transition-colors',
                isDropTarget && 'cursor-pointer hover:bg-primary/10',
              )}
            >
              {/* Tier Label Column */}
              <div
                className={cn(
                  'flex w-full shrink-0 items-center justify-between px-4 py-2.5 sm:w-40 sm:flex-col sm:justify-center sm:text-center',
                  tier.badgeBg,
                  tier.badgeText,
                )}
              >
                <input
                  type="text"
                  value={labels[tier.id]}
                  onChange={(e) => setLabels((prev) => ({ ...prev, [tier.id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Edit ${tier.id} tier name`}
                  className="w-full bg-transparent text-sm font-extrabold tracking-tight outline-none sm:text-center"
                />
                <span className="text-[11px] font-bold opacity-80">{items.length}</span>
              </div>

              {/* Tier Cards Area */}
              <div className="flex flex-1 flex-wrap items-center gap-2.5 p-3">
                {items.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {isDropTarget
                      ? `Tap here to place in ${labels[tier.id]}`
                      : 'Empty tier — select a show below to place here'}
                  </span>
                ) : (
                  items.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedEntryId((prev) => (prev === entry.id ? null : entry.id))
                      }}
                      className={cn(
                        'group relative h-24 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-all',
                        selectedEntryId === entry.id
                          ? 'scale-105 border-2 border-primary ring-2 ring-primary/40'
                          : 'border-white/15 hover:border-primary/60',
                      )}
                      title={entry.title}
                    >
                      <img
                        src={entry.coverImage || '/placeholder.svg'}
                        alt={entry.title}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromTier(entry.id)
                        }}
                        aria-label={`Remove ${entry.title} from tier`}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* Active Selection Helper Bar */}
      {selectedEntryId !== null && entryMap.get(selectedEntryId) && (
        <div className="glass-panel sticky bottom-20 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-primary/40 bg-[#121215]/95 px-4 py-3 shadow-2xl md:bottom-6">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="size-4 text-primary" />
            <span className="text-muted-foreground">Assigning:</span>
            <span className="font-bold text-white">{entryMap.get(selectedEntryId)?.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => assignToTier(selectedEntryId, t.id)}
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-extrabold transition-transform active:scale-95',
                  t.badgeBg,
                  t.badgeText,
                )}
              >
                {t.id}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedEntryId(null)}
              className="ml-1 flex size-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Unranked Watchlist Pool */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">
            Your Watchlist Pool ({unrankedPool.length} unranked)
          </h2>
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(
              [
                { value: 'ALL', label: 'All' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'WATCHING', label: 'Watching' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPoolFilter(tab.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  poolFilter === tab.value
                    ? 'bg-primary text-white active-pill'
                    : 'text-muted-foreground hover:text-white',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {!mounted ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-card" />
        ) : watchlist.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-xs text-muted-foreground">
            Your watchlist is empty. Add anime to your watchlist first to build a custom tier list!
          </div>
        ) : unrankedPool.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-center text-xs text-muted-foreground">
            All shows in this filter are ranked! Switch filter to <strong>All</strong> or export your PNG above.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {unrankedPool.map((entry) => {
              const isSelected = selectedEntryId === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntryId(isSelected ? null : entry.id)}
                  className={cn(
                    'group relative flex flex-col gap-1 rounded-xl border p-1 text-left transition-all',
                    isSelected
                      ? 'scale-[1.03] border-primary bg-primary/20 shadow-lg'
                      : 'border-white/10 bg-card hover:border-primary/40',
                  )}
                >
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
                    <img
                      src={entry.coverImage || '/placeholder.svg'}
                      alt={entry.title}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="line-clamp-1 px-0.5 text-[10px] font-medium text-foreground/90">
                    {entry.title}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
