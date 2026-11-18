import { notFound } from 'next/navigation'
import { CharacterDetailView } from '@/components/person-detail-view'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) notFound()
  return <CharacterDetailView id={numericId} />
}
