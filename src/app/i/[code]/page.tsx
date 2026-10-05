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
  const ogImageUrl = 'https://khandelwalinvite.vercel.app/og.jpg'

  return {
    metadataBase: new URL('https://khandelwalinvite.vercel.app'),
    title: "Arpit's 40th & Diwali Bash",
    description: 'Personal Video Invitation — Tap to Play',
    openGraph: {
      type: 'website',
      url: `https://khandelwalinvite.vercel.app/i/${code}`,
      title: "Arpit's 40th & Diwali Bash",
      description: 'Personal Video Invitation — Tap to Play',
      siteName: "Arpit's 40th & Diwali Bash",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: "Arpit's 40th & Diwali Bash Video Invitation",
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: "Arpit's 40th & Diwali Bash",
      description: 'Personal Video Invitation — Tap to Play',
      images: [ogImageUrl],
    },
  }
}
