'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Guest, trackEvent, updateGuestStatus, submitRSVP } from '@/lib/supabase'
import OpeningScreen from '@/components/OpeningScreen'
import VideoScreen from '@/components/VideoScreen'
import ConfirmationScreen from '@/components/ConfirmationScreen'

type Screen = 'opening' | 'video' | 'confirmation'

interface Props {
  guest: Guest
  inviteCode: string
}

export default function InvitationClient({ guest, inviteCode }: Props) {
  const [screen, setScreen] = useState<Screen>('video')
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'declined' | null>(null)
  const searchParams = useSearchParams()

  const isSTD = searchParams?.get('type') === 'std' || searchParams?.get('mode') === 'save_date'
  const activeVideoUrl = isSTD
    ? (guest.std_video_url || '/videos/Save the date vedio.mp4')
    : (guest.video_url || '/videos/teaser.mp4')

  // Track invitation opened & entered video directly
  useEffect(() => {
    trackEvent(guest.id, inviteCode, isSTD ? 'std_opened' : 'invitation_opened')
    trackEvent(guest.id, inviteCode, isSTD ? 'std_entered' : 'invitation_entered')
    updateGuestStatus(guest.id, 'entered')
  }, [guest.id, inviteCode, isSTD])

  const handleEnter = () => {
    trackEvent(guest.id, inviteCode, 'invitation_entered')
    updateGuestStatus(guest.id, 'entered')
    setScreen('video')
  }

  const handleVideoStart = () => {
    trackEvent(guest.id, inviteCode, 'video_started')
  }

  const handleSelectYes = async () => {
    trackEvent(guest.id, inviteCode, 'rsvp_attending')
    await submitRSVP(guest.id, 'attending', guest.invited_count || 1)
    setRsvpStatus('attending')
    setScreen('confirmation')
  }

  const handleSelectNo = async () => {
    trackEvent(guest.id, inviteCode, 'rsvp_declined')
    await submitRSVP(guest.id, 'declined', 0)
    setRsvpStatus('declined')
    setScreen('confirmation')
  }

  function getDisplayName(nickname?: string, fullName?: string): string {
    if (nickname && nickname.trim()) return nickname.trim()
    if (!fullName || !fullName.trim()) return ''
    return fullName.trim()
  }

  const primaryDisplay = getDisplayName(guest.nickname, guest.first_name)
  const partnerDisplay = getDisplayName(undefined, guest.partner_name)

  // Give preference to Nickname first, then First Name (stripping surnames)
  const guestDisplayName = (guest.send_together && partnerDisplay)
    ? `${primaryDisplay} & ${partnerDisplay}`
    : primaryDisplay

  return (
    <div className="grain relative w-full full-viewport-height overflow-hidden bg-[#050D1A]">
      {/* Opening — always rendered, hidden when not active */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'opening' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <OpeningScreen
          guestName={guestDisplayName}
          onEnter={handleEnter}
        />
      </div>

      {/* Video */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'video' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <VideoScreen
          guestName={guestDisplayName}
          guestId={guest.id}
          videoUrl={activeVideoUrl}
          inviteCode={guest.invite_code}
          onSelectYes={handleSelectYes}
          onSelectNo={handleSelectNo}
          onStart={handleVideoStart}
          active={screen === 'video'}
        />
      </div>

      {/* Confirmation */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'confirmation' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <ConfirmationScreen
          guest={guest}
          guestName={guestDisplayName}
          status={rsvpStatus}
          onBack={() => setScreen('video')}
        />
      </div>
    </div>
  )
}
