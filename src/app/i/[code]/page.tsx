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

function getDisplayName(nickname?: string, fullName?: string): string {
  if (nickname && nickname.trim()) return nickname.trim()
  if (!fullName || !fullName.trim()) return ''
  return fullName.trim().split(' ')[0]
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params

  let guestName = 'Honored Guest'
  try {
    const guest = await getGuestByCode(code)
    if (guest) {
      const primaryDisplay = getDisplayName(guest.nickname, guest.first_name)
      const partnerDisplay = getDisplayName(undefined, guest.partner_name)
      guestName = (guest.send_together && partnerDisplay)
        ? `${primaryDisplay} & ${partnerDisplay}`
        : (primaryDisplay || 'Honored Guest')
    }
  } catch {}

  const titleText = `Arpit's 40th & Diwali Bash — For ${guestName}`
  const descText = 'A personal invitation — Friday, 23 October 2026, Jaipur.'
  return {
    metadataBase: new URL('https://khandelwalinvite.vercel.app'),
    title: titleText,
    description: descText,
    openGraph: {
      type: 'website',
      url: `https://khandelwalinvite.vercel.app/i/${code}`,
      title: titleText,
      description: descText,
      siteName: "Arpit's 40th & Diwali Bash",
    },
    twitter: {
      card: 'summary',
      title: titleText,
      description: descText,
    },
  }
}
