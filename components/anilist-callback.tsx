'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { completeOAuthLogin, parseOAuthHash } from '@/lib/anilist-account'

type State = { kind: 'working' } | { kind: 'done'; name: string } | { kind: 'error'; message: string }

export function AniListCallback() {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'working' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const parsed = parseOAuthHash(window.location.hash)
    // Remove the token from the address bar and history immediately.
    window.history.replaceState(null, '', window.location.pathname)
    if (!parsed) {
      const error = new URLSearchParams(window.location.search).get('error_description')
      setState({ kind: 'error', message: error ?? 'No access token was returned by AniList.' })
      return
    }
    completeOAuthLogin(parsed.token, parsed.expiresAt)
      .then((viewer) => {
        setState({ kind: 'done', name: viewer.name })
        if (window.opener && window.opener !== window) setTimeout(() => window.close(), 1200)
        else setTimeout(() => router.replace('/watchlist'), 1200)
      })
      .catch((err) => setState({ kind: 'error', message: err instanceof Error ? err.message : 'Login failed.' }))
  }, [router])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center" role="status">
      {state.kind === 'working' && (
        <>
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="font-medium">Connecting your AniList account…</p>
        </>
      )}
      {state.kind === 'done' && (
        <>
          <CheckCircle2 className="size-8 text-airing" aria-hidden="true" />
          <p className="font-medium">Logged in as {state.name}</p>
          <p className="text-sm text-muted-foreground">Your list has been synced. Redirecting…</p>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
          <p className="font-medium">Could not connect to AniList</p>
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Link href="/watchlist" className="mt-2 text-sm font-medium text-primary hover:underline">
            Back to watchlist
          </Link>
        </>
      )}
    </div>
  )
}
