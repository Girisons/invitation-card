import { headers } from 'next/headers'
import InvitationClient from './InvitationClient'
import { getGuestByCode, Guest } from '@/lib/supabase'
import { resolveGuestDisplayName, resolveGuestAndPartnerNames } from '@/lib/thankYouCard'

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

  let guest: Guest | null = null
  if (code) {
    try {
      guest = await getGuestByCode(code)
    } catch {}
  }
  const rawName = (guest?.nickname && guest.nickname.trim())
    ? guest.nickname.trim()
    : (guest?.first_name && guest.first_name.trim())
    ? guest.first_name.trim().split(' ')[0]
    : ''
  // Proper Title Case formatting (e.g. PALAK -> Palak)
  const individualName = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
    : ''

  const isThankYouAttended = inviteType === 'thankyou_attended' || inviteType === 'thank_you_attended' || inviteType === 'attended'
  const isThankYouMissed = inviteType === 'thankyou_missed' || inviteType === 'thank_you_missed' || inviteType === 'missed'
  const isThankYouAttendedPartnerMissed =
    inviteType === 'thankyou_attended_partner_missed' ||
    inviteType === 'attended_partner_missed'
  const isThankYouMissedPartnerAttended =
    inviteType === 'thankyou_missed_partner_attended' ||
    inviteType === 'missed_partner_attended'
  const isThankYouAuto = inviteType === 'thankyou' || inviteType === 'thank_you' || inviteType === 'thank-you'
  const isThankYou =
    isThankYouAttended ||
    isThankYouMissed ||
    isThankYouAttendedPartnerMissed ||
    isThankYouMissedPartnerAttended ||
    isThankYouAuto
  const isInstaSoiree = inviteType === 'insta_soiree' || inviteType === 'soiree_insta' || inviteType === 'insta_diwali'
  const isInsta40 = inviteType === 'insta' || inviteType === 'instagram' || inviteType === '40andfestive'
  const isInsta = isInstaSoiree || isInsta40
  const isDiwaliSaveDate = inviteType === 'save_date_diwali' || inviteType === 'std_diwali' || inviteType === 'diwali' || inviteType === 'save-date-diwali'
  const isDiwaliMain = inviteType === 'main_diwali' || inviteType === 'invite_diwali' || inviteType === 'diwali_main' || inviteType === 'diwali_invite'
  const isDiwali = isDiwaliSaveDate || isDiwaliMain
  const isSaveTheDate = isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date'

  let title = "The Night Awaits — Arpit's 40th & Diwali Celebration"
  let description = "Personal Video Invitation • Tap to open"
  let ogImageUrl = "https://khandelwalinvite.vercel.app/og-main.jpg?v=5"

  if (isThankYou) {
    const tyVariant = isThankYouAttendedPartnerMissed
      ? 'attended_partner_missed'
      : isThankYouMissedPartnerAttended
      ? 'missed_partner_attended'
      : isThankYouMissed
      ? 'missed'
      : 'attended'
    const isAttendedTheme = tyVariant === 'attended' || tyVariant === 'attended_partner_missed'
    const resolvedCardName = guest ? resolveGuestDisplayName(guest, undefined, tyVariant) : ''
    const resolvedPartnerRef = guest ? resolveGuestAndPartnerNames(guest).partnerInlineRef : ''
    title = isAttendedTheme
      ? resolvedCardName
        ? `40 & FESTIVE ✨ • Dear ${resolvedCardName} — The Night Was Better With You`
        : `40 & FESTIVE ✨ • The Night Was Better With You`
      : resolvedCardName
      ? `40 & FESTIVE ✨ • Dear ${resolvedCardName} — You Were Missed`
      : `40 & FESTIVE ✨ • You Were Missed`
    description = isAttendedTheme
      ? `A personal note of gratitude from Tanvi, Arpit & Family. Tap to open your personalised card ✨`
      : `Remembered with warmth and affection — Tanvi, Arpit & Family. Tap to open your personalised card ✨`
    const nameParam = resolvedCardName ? `&name=${encodeURIComponent(resolvedCardName)}` : ''
    const partnerParam = resolvedPartnerRef ? `&partner=${encodeURIComponent(resolvedPartnerRef)}` : ''
    ogImageUrl = `https://khandelwalinvite.vercel.app/api/thank-you-card?code=${encodeURIComponent(code.toUpperCase())}&type=${tyVariant}${nameParam}${partnerParam}`
  } else if (isInstaSoiree) {
    title = individualName
      ? `The Festive Soirée ✨ • Dear ${individualName}, Follow Us on Instagram @40andfestive!`
      : "The Festive Soirée ✨ • Follow Us on Instagram @40andfestive!"
    description = individualName
      ? `Hey ${individualName}! 📸✨ Please follow our official page @40andfestive to catch all the exclusive celebration reels, live party updates, behind-the-scenes fun & unforgettable memories from The Festive Soirée & Diwali Celebration! Tap here to open & follow ➔ @40andfestive`
      : "📸✨ Please follow our official page @40andfestive to catch all the exclusive celebration reels, live party updates, behind-the-scenes fun & unforgettable memories from The Festive Soirée & Diwali Celebration! Tap here to open & follow ➔ @40andfestive"
    ogImageUrl = "https://khandelwalinvite.vercel.app/og-insta-soiree.jpg?v=1"
  } else if (isInsta40) {
    title = individualName
      ? `40 & Festive ✨ • Dear ${individualName}, Follow Us on Instagram @40andfestive!`
      : "40 & Festive ✨ • Follow Us on Instagram @40andfestive!"
    description = individualName
      ? `Hey ${individualName}! 📸✨ Please follow our official page @40andfestive to catch all the exclusive celebration reels, live party updates, behind-the-scenes fun & unforgettable memories from Arpit’s 40th & Diwali Bash! Tap here to open & follow ➔ @40andfestive`
      : "📸✨ Please follow our official page @40andfestive to catch all the exclusive celebration reels, live party updates, behind-the-scenes fun & unforgettable memories from Arpit’s 40th & Diwali Bash! Tap here to open & follow ➔ @40andfestive"
    ogImageUrl = "https://khandelwalinvite.vercel.app/og-insta.jpg?v=12"
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
      title = "The Festive Soirée — Khandelwal Diwali Celebration"
      description = "Diwali Invitation • Tap to open"
      ogImageUrl = "https://khandelwalinvite.vercel.app/og-diwali-main.jpg?v=7"
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
          width: isThankYou ? 1080 : isInsta ? 800 : 1200,
          height: isThankYou ? 1350 : isInsta ? 800 : 630,
          type: isThankYou ? 'image/png' : 'image/jpeg',
          alt: `${title}`,
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
