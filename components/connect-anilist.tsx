'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Copy, Link2, Loader2, LogOut, RefreshCw, Upload, X } from 'lucide-react'
import {
  importByUsername,
  logout,
  pullViewerList,
  pushUnsyncedEntries,
  startOAuthLogin,
  useAniListAccount,
} from '@/lib/anilist-account'
import { useWatchlist } from '@/lib/watchlist'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

const inputClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
const primaryButton =
  'flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
const secondaryButton =
  'flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-accent disabled:opacity-60'

export function ConnectAniListButton({ variant = 'nav' }: { variant?: 'nav' | 'inline' }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const account = useAniListAccount()
  const viewer = account.viewer

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={cn(
          variant === 'nav'
            ? 'flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-accent'
            : secondaryButton,
        )}
      >
        {viewer ? (
          <>
            <span className="relative">
              <img src={viewer.avatar.medium || '/placeholder.svg'} alt="" className="size-5 rounded-full object-cover" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background',
                  account.syncState === 'error' ? 'bg-destructive' : account.syncState === 'syncing' ? 'bg-upcoming' : 'bg-airing',
                )}
                aria-hidden="true"
              />
            </span>
            <span className={cn(variant === 'nav' && 'sr-only lg:not-sr-only')}>{viewer.name}</span>
          </>
        ) : (
          <>
            <Link2 className="size-4" aria-hidden="true" />
            <span className={cn(variant === 'nav' && 'sr-only lg:not-sr-only')}>Connect AniList</span>
          </>
        )}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="anilist-dialog-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-background/70 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close()
        }}
      >
        <div className="flex max-h-[85vh] flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="anilist-dialog-title" className="text-base font-semibold">
              AniList account
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-6 p-5">
            {viewer ? <ConnectedPanel /> : <OAuthPanel />}
            <UsernameImport />
          </div>
        </div>
      </dialog>
    </>
  )
}

function Feedback({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg p-2.5 text-xs',
        tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-airing/10 text-airing',
      )}
    >
      {tone === 'error' ? (
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      )}
      {children}
    </p>
  )
}

function ConnectedPanel() {
  const account = useAniListAccount()
  const list = useWatchlist()
  const [busy, setBusy] = useState<'pull' | 'push' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const viewer = account.viewer!
  const unsynced = list.filter((e) => !e.remoteId).length

  const pull = async () => {
    setBusy('pull')
    setMessage(null)
    try {
      const n = await pullViewerList()
      setMessage(`Pulled ${n} updated ${n === 1 ? 'entry' : 'entries'} from AniList.`)
    } catch {
      // Error is surfaced through account.syncError.
    } finally {
      setBusy(null)
    }
  }

  const push = async () => {
    setBusy('push')
    setMessage(null)
    try {
      const n = await pushUnsyncedEntries((done, total) => setMessage(`Pushing ${done} of ${total}…`))
      setMessage(`Pushed ${n} ${n === 1 ? 'entry' : 'entries'} to AniList.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Connected account" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <img src={viewer.avatar.medium || '/placeholder.svg'} alt="" className="size-11 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{viewer.name}</p>
          <p className="text-xs text-muted-foreground">
            {account.syncState === 'syncing'
              ? 'Syncing…'
              : account.lastSyncAt
                ? `Last synced ${timeAgo(account.lastSyncAt)}`
                : 'Connected'}
          </p>
        </div>
        <button type="button" onClick={logout} className={secondaryButton}>
          <LogOut className="size-4" aria-hidden="true" /> Log out
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Two-way sync is on. Status, episode progress, and your 1–10 score are sent to AniList whenever you change them here.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={pull} disabled={busy !== null} className={secondaryButton}>
          {busy === 'pull' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Pull from AniList
        </button>
        <button type="button" onClick={push} disabled={busy !== null || unsynced === 0} className={secondaryButton}>
          {busy === 'push' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          Push {unsynced} local-only {unsynced === 1 ? 'entry' : 'entries'}
        </button>
      </div>
      {account.syncError && <Feedback tone="error">{account.syncError}</Feedback>}
      {message && !account.syncError && <Feedback tone="ok">{message}</Feedback>}
    </section>
  )
}

function OAuthPanel() {
  const account = useAniListAccount()
  const [clientId, setClientIdValue] = useState(account.clientId)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => setOrigin(window.location.origin), [])
  const redirect = `${origin}/auth/anilist`
  const valid = /^\d{3,10}$/.test(clientId.trim())

  return (
    <section aria-labelledby="oauth-heading" className="flex flex-col gap-3">
      <div>
        <h3 id="oauth-heading" className="text-sm font-semibold">
          Log in for two-way sync
        </h3>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>
            Create a client at{' '}
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              anilist.co/settings/developer
            </a>
            .
          </li>
          <li>Set its Redirect URL to the address below.</li>
          <li>Paste the Client ID here and log in.</li>
        </ol>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{redirect}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(redirect)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Copy redirect URL"
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) startOAuthLogin(clientId)
        }}
      >
        <label className="flex-1">
          <span className="sr-only">AniList Client ID</span>
          <input
            value={clientId}
            onChange={(e) => setClientIdValue(e.target.value)}
            inputMode="numeric"
            placeholder="Client ID, e.g. 12345"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={!valid} className={primaryButton}>
          Log in
        </button>
      </form>
      {account.syncError && <Feedback tone="error">{account.syncError}</Feedback>}
    </section>
  )
}

function UsernameImport() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  return (
    <section aria-labelledby="import-heading" className="flex flex-col gap-3 border-t border-border pt-5">
      <div>
        <h3 id="import-heading" className="text-sm font-semibold">
          Quick import by username
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Copy any public AniList list into your watchlist. This is one-way and never edits that account.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setResult(null)
          try {
            const { userName, count } = await importByUsername(name)
            setResult({ tone: 'ok', text: `Imported ${count} ${count === 1 ? 'entry' : 'entries'} from ${userName}.` })
          } catch (err) {
            setResult({ tone: 'error', text: err instanceof Error ? err.message : 'Import failed.' })
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="flex-1">
          <span className="sr-only">AniList username</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AniList username"
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy || name.trim().length < 2} className={secondaryButton}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Import
        </button>
      </form>
      {result && <Feedback tone={result.tone}>{result.text}</Feedback>}
    </section>
  )
}
