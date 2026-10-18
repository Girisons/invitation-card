import InvitationClient from './InvitationClient'
import { getGuestByCode, Guest } from '@/lib/supabase'

interface Props {
  params: Promise<{ code: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function InvitationPage({ params, searchParams }: Props) {
  const { code } = await params
  const sParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(sParams.type) ? sParams.type[0] : sParams.type
  const rawMode = Array.isArray(sParams.mode) ? sParams.mode[0] : sParams.mode
  const inviteType = (rawType || rawMode || '').toLowerCase()

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

  return <InvitationClient guest={activeGuest} inviteCode={code.toUpperCase()} inviteType={inviteType} />
}

function getDisplayName(nickname?: string, fullName?: string): string {
  if (nickname && nickname.trim()) return nickname.trim()
  if (!fullName || !fullName.trim()) return ''
  return fullName.trim().split(' ')[0]
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { code } = await params
  const sParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(sParams.type) ? sParams.type[0] : sParams.type
  const rawMode = Array.isArray(sParams.mode) ? sParams.mode[0] : sParams.mode
  const inviteType = (rawType || rawMode || '').toLowerCase()

  const isDiwaliSaveDate = inviteType === 'save_date_diwali' || inviteType === 'std_diwali' || inviteType === 'diwali' || inviteType === 'save-date-diwali'
  const isDiwaliMain = inviteType === 'main_diwali' || inviteType === 'invite_diwali' || inviteType === 'diwali_main' || inviteType === 'diwali_invite'
  const isDiwali = isDiwaliSaveDate || isDiwaliMain
  const isSaveTheDate = isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date'

  let title = "The Night Awaits — Arpit's 40th & Diwali Celebration"
  let description = "Personal Video Invitation • Tap to open"
  let ogImageUrl = "https://khandelwalinvite.vercel.app/og-main.jpg?v=3"

  if (isSaveTheDate) {
    if (isDiwali) {
      title = "Grand Diwali Party Celebration"
      description = "Diwali Invitation - Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-diwali.jpg?v=2"
    } else {
      title = "Arpit's 40th & Diwali Bash"
      description = "Invitation - Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og.jpg"
    }
  } else {
    // Main Invite
    if (isDiwali) {
      title = "The Night Awaits — Khandelwal Diwali Celebration"
      description = "Personal Video Invitation • Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-diwali-main.jpg?v=3"
    } else {
      title = "The Night Awaits — Arpit's 40th & Diwali Celebration"
      description = "Personal Video Invitation • Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-main.jpg?v=3"
    }
  }

  const queryParam = rawType ? `?type=${rawType}` : rawMode ? `?mode=${rawMode}` : ''
  const pageUrl = `https://khandelwalinvite.vercel.app/i/${code}${queryParam}`

  return {
    metadataBase: new URL('https://khandelwalinvite.vercel.app'),
    title,
    description,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title,
      description,
      siteName: title,
      images: [
        {
          url: ogImageUrl,
          secureUrl: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: `${title} Video Invitation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}
