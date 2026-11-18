import Link from 'next/link'
import type { PersonRef } from '@/lib/anilist'

export function CharacterCard({
  character,
  role,
  voiceActor,
}: {
  character: PersonRef
  role: string
  voiceActor?: PersonRef
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card">
      <Link
        href={`/character/${character.id}`}
        className="flex min-w-0 flex-1 gap-3 p-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Avatar src={character.image.large} />
        <div className="flex min-w-0 flex-col justify-center">
          <p className="truncate text-sm font-medium">{character.name.full}</p>
          <p className="text-xs capitalize text-muted-foreground">{role.toLowerCase()}</p>
        </div>
      </Link>
      {voiceActor && (
        <Link
          href={`/staff/${voiceActor.id}`}
          className="flex min-w-0 flex-1 flex-row-reverse gap-3 border-l border-border p-2 text-right transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Avatar src={voiceActor.image.large} />
          <div className="flex min-w-0 flex-col justify-center">
            <p className="truncate text-sm font-medium">{voiceActor.name.full}</p>
            <p className="text-xs text-muted-foreground">Japanese VA</p>
          </div>
        </Link>
      )}
    </div>
  )
}

export function StaffCard({ staff, role }: { staff: PersonRef; role: string }) {
  return (
    <Link
      href={`/staff/${staff.id}`}
      className="flex gap-3 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Avatar src={staff.image.large} />
      <div className="flex min-w-0 flex-col justify-center">
        <p className="truncate text-sm font-medium">{staff.name.full}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{role}</p>
      </div>
    </Link>
  )
}

function Avatar({ src }: { src: string | null }) {
  return src ? (
    <img src={src || "/placeholder.svg"} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-md object-cover" />
  ) : (
    <div className="h-16 w-12 shrink-0 rounded-md bg-muted" />
  )
}
