import { notFound } from 'next/navigation'
import InvitationClient from './InvitationClient'
import { getGuestByCode } from '@/lib/supabase'

interface Props {
  params: Promise<{ code: string }>
}

export default async function InvitationPage({ params }: Props) {
  const { code } = await params

  try {
    const guest = await getGuestByCode(code)
    if (!guest) notFound()
    return <InvitationClient guest={guest!} inviteCode={code.toUpperCase()} />
  } catch {
    notFound()
  }
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params

  try {
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
  } catch {
    return { title: 'Invitation' }
  }
}
