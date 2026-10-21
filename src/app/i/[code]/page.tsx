import { headers } from 'next/headers'
import InvitationClient from './InvitationClient'
import { getGuestByCode, Guest } from '@/lib/supabase'

interface Props {
  params: Promise<{ code: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

const CRAWLER_UA_REGEX = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview/i

export default async function InvitationPage({ params, searchParams }: Props) {
  const { code } = await params
  const sParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(sParams.type) ? sParams.type[0] : sParams.type
  const rawMode = Array.isArray(sParams.mode) ? sParams.mode[0] : sParams.mode
  const inviteType = (rawType || rawMode || '').toLowerCase()

  const reqHeaders = await headers()
  const ua = reqHeaders.get('user-agent') || ''
  const isCrawler = CRAWLER_UA_REGEX.test(ua)

  let guest: Guest | null = null
  if (!isCrawler) {
    try {
      guest = await getGuestByCode(code)
    } catch (err) {
      console.error('Error fetching guest by code:', err)
    }
  }

  // Fallback guest if code is not found in database or if request is from a social link-preview crawler
  const activeGuest: Guest = guest || {
    id: 'guest-' + code,
    invite_code: code.toUpperCase(),
    first_name: 'Honored Guest',
    invited_count: 1,
    invitation_status: 'pending',
  }

  return <InvitationClient guest={activeGuest} inviteCode={code.toUpperCase()} inviteType={inviteType} />
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { code } = await params
  const sParams = searchParams ? await searchParams : {}
  const rawType = Array.isArray(sParams.type) ? sParams.type[0] : sParams.type
  const rawMode = Array.isArray(sParams.mode) ? sParams.mode[0] : sParams.mode
  const rawV = Array.isArray(sParams.v) ? sParams.v[0] : sParams.v
  const inviteType = (rawType || rawMode || '').toLowerCase()

  const isInsta = inviteType === 'insta' || inviteType === 'instagram' || inviteType === '40andfestive'
  const isDiwaliSaveDate = inviteType === 'save_date_diwali' || inviteType === 'std_diwali' || inviteType === 'diwali' || inviteType === 'save-date-diwali'
  const isDiwaliMain = inviteType === 'main_diwali' || inviteType === 'invite_diwali' || inviteType === 'diwali_main' || inviteType === 'diwali_invite'
  const isDiwali = isDiwaliSaveDate || isDiwaliMain
  const isSaveTheDate = isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date'

  let title = "The Night Awaits — Arpit's 40th & Diwali Celebration"
  let description = "Personal Video Invitation • Tap to open"
  let ogImageUrl = "https://khandelwalinvite.vercel.app/og-main.jpg?v=5"

  if (isInsta) {
    title = "@40andfestive — Official Instagram Page"
    description = "Follow Arpit's 40th & Diwali Celebration on Instagram • Tap to open"
    ogImageUrl = "https://khandelwalinvite.vercel.app/og-insta.jpg"
  } else if (isSaveTheDate) {
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
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-diwali-main.jpg?v=5"
    } else {
      title = "The Night Awaits — Arpit's 40th & Diwali Celebration"
      description = "Personal Video Invitation • Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-main.jpg?v=5"
    }
  }

  const qsParts: string[] = []
  if (rawType) qsParts.push(`type=${encodeURIComponent(rawType)}`)
  else if (rawMode) qsParts.push(`mode=${encodeURIComponent(rawMode)}`)
  if (rawV) qsParts.push(`v=${encodeURIComponent(rawV)}`)
  const queryParam = qsParts.length > 0 ? `?${qsParts.join('&')}` : ''
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
