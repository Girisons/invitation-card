import InvitationClient from './InvitationClient'
import { getGuestByCode, Guest } from '@/lib/supabase'

interface Props {
  params: Promise<{ code: string }>
}

export default async function InvitationPage({ params }: Props) {
  const { code } = await params

  let guest: Guest | null = null
  try {
    guest = await getGuestByCode(code)
  } catch (err) {
    console.error('Error fetching guest by code:', err)
  }

  // Fallback guest if code is not found in database or if database connection is pending
  const activeGuest: Guest = guest || {
    id: 'guest-' + code,
    invite_code: code.toUpperCase(),
    first_name: 'Honored Guest',
    invited_count: 1,
    invitation_status: 'pending',
  }

  return <InvitationClient guest={activeGuest} inviteCode={code.toUpperCase()} />
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params

  let guestName = 'Honored Guest'
  try {
    const guest = await getGuestByCode(code)
    if (guest?.first_name) {
      guestName = (guest.send_together && guest.partner_name)
        ? `${guest.first_name} & ${guest.partner_name}`
        : `${guest.first_name}${guest.last_name ? ' ' + guest.last_name : ''}`
    }
  } catch {}

  return {
    metadataBase: new URL('https://khandelwalinvite.vercel.app'),
    title: `Arpit's 40th & Diwali Bash — For ${guestName}`,
    description: 'A personal invitation — Friday, 23 October 2026, Jaipur.',
    openGraph: {
      title: `Arpit's 40th & Diwali Bash — For ${guestName}`,
      description: 'A personal invitation — Friday, 23 October 2026, Jaipur.',
      images: [{
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: "Arpit's 40th & Diwali Bash Invitation",
      }],
    },
  }
}
