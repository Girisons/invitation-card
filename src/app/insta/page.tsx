import { getGuestByCode, Guest } from '@/lib/supabase'
import InstaScreen from '@/components/InstaScreen'

interface Props {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props) {
  const sParams = searchParams ? await searchParams : {}
  const rawCode = Array.isArray(sParams.code) ? sParams.code[0] : sParams.code
  const code = (rawCode || '').toUpperCase().trim()

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

  const title = individualName
    ? `Dear ${individualName} ✨ 40 & Festive`
    : "40 & Festive ✨ @40andfestive"
  const description = "The Party • The People • The Reels"
  const ogImageUrl = "https://khandelwalinvite.vercel.app/og-insta.jpg?v=7"

  return {
    metadataBase: new URL('https://khandelwalinvite.vercel.app'),
    title,
    description,
    openGraph: {
      type: 'website',
      url: code ? `https://khandelwalinvite.vercel.app/insta?code=${code}` : 'https://khandelwalinvite.vercel.app/insta',
      title,
      description,
      siteName: "Arpit's 40th & Diwali Bash",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: "@40andfestive Instagram Invitation",
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

export default async function InstaPage({ searchParams }: Props) {
  const sParams = searchParams ? await searchParams : {}
  const rawCode = Array.isArray(sParams.code) ? sParams.code[0] : sParams.code
  const code = (rawCode || '').toUpperCase().trim()

  let guest: Guest | null = null
  if (code) {
    try {
      guest = await getGuestByCode(code)
    } catch (err) {
      console.error('Error fetching guest for insta:', err)
    }
  }

  const activeGuest: Guest | undefined = guest || (code ? {
    id: 'guest-' + code,
    invite_code: code,
    first_name: 'Honored Guest',
    invited_count: 1,
    invitation_status: 'pending',
  } : undefined)

  return <InstaScreen guest={activeGuest} inviteCode={code} />
}
