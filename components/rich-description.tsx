'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

function normalize(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(__|\*\*)(.+?)\1|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\(([^)]*)\)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const key = `${keyPrefix}-${i++}`
    if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {match[2]}
        </strong>,
      )
    } else if (match[3] && match[4]) {
      nodes.push(
        <a key={key} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
          {match[3]}
        </a>,
      )
    } else if (match[5]) {
      nodes.push(match[5])
    }
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  if (revealed) {
    return (
      <span className="rounded bg-destructive/10 px-0.5 text-foreground ring-1 ring-destructive/30">{children}</span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="group relative inline rounded bg-muted px-1 text-left align-baseline focus-visible:outline-2 focus-visible:outline-primary"
      aria-label="Spoiler hidden. Click to reveal."
    >
      <span className="select-none blur-sm transition group-hover:blur-[3px]" aria-hidden="true">
        {children}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-destructive">
        Spoiler
      </span>
    </button>
  )
}

export function RichDescription({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return <p className={cn('text-muted-foreground', className)}>No description available.</p>
  const clean = normalize(text)
  const parts = clean.split(/~!([\s\S]*?)!~/g)
  return (
    <div className={cn('whitespace-pre-line leading-relaxed text-muted-foreground', className)}>
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <Spoiler key={idx}>{renderInline(part.trim(), `s${idx}`)}</Spoiler>
        ) : (
          <span key={idx}>{renderInline(part, `t${idx}`)}</span>
        ),
      )}
    </div>
  )
}
