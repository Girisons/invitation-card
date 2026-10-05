'use client'

import { useState, useEffect } from 'react'
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

  // Track invitation opened & entered video directly
  useEffect(() => {
    trackEvent(guest.id, inviteCode, 'invitation_opened')
    trackEvent(guest.id, inviteCode, 'invitation_entered')
    updateGuestStatus(guest.id, 'entered')
  }, [guest.id, inviteCode])

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

  function getFirstName(fullName?: string): string {
    if (!fullName) return ''
    const trimmed = fullName.trim()
    return trimmed.split(' ')[0]
  }

  const primaryFirst = guest.nickname || getFirstName(guest.first_name)
  const partnerFirst = getFirstName(guest.partner_name)

  // Show first names only (no surnames in video or invite overlay)
  const guestDisplayName = (guest.send_together && partnerFirst)
    ? `${primaryFirst} & ${partnerFirst}`
    : primaryFirst

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
          videoUrl={guest.video_url}
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
