import { notFound } from 'next/navigation'
import { getGuestByCode } from '@/lib/supabase'
import InvitationClient from './InvitationClient'

interface Props {
  params: Promise<{ code: string }>
}

export default async function InvitationPage({ params }: Props) {
  const { code } = await params
  const guest = await getGuestByCode(code)

  if (!guest) {
    notFound()
  }

  return <InvitationClient guest={guest} inviteCode={code.toUpperCase()} />
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params
  const guest = await getGuestByCode(code)

  if (!guest) return { title: 'Invitation' }

  return {
    title: `A personal invitation for ${guest.first_name}`,
    description: 'You have received a personal invitation to Arpit @ 40 × Diwali.',
    openGraph: {
      title: `Arpit @ 40 × Diwali — For ${guest.first_name}`,
      description: 'A personal invitation — 23 October 2026, Jaipur.',
      images: ['/og.jpg'],
    },
  }
}
