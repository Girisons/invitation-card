'use client'

import { useState, useEffect } from 'react'
import { Guest, trackEvent, updateGuestStatus } from '@/lib/supabase'
import OpeningScreen from '@/components/OpeningScreen'
import VideoScreen from '@/components/VideoScreen'
import RSVPScreen from '@/components/RSVPScreen'
import ConfirmationScreen from '@/components/ConfirmationScreen'

type Screen = 'opening' | 'video' | 'rsvp' | 'confirmation'

interface Props {
  guest: Guest
  inviteCode: string
}

export default function InvitationClient({ guest, inviteCode }: Props) {
  const [screen, setScreen] = useState<Screen>('opening')
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'declined' | null>(null)

  // Track invitation opened
  useEffect(() => {
    trackEvent(guest.id, inviteCode, 'invitation_opened')
    updateGuestStatus(guest.id, 'opened')
  }, [guest.id, inviteCode])

  const handleEnter = () => {
    trackEvent(guest.id, inviteCode, 'invitation_entered')
    updateGuestStatus(guest.id, 'entered')
    setScreen('video')
  }

  const handleVideoEnd = () => {
    trackEvent(guest.id, inviteCode, 'video_completed')
    setScreen('rsvp')
  }

  const handleVideoStart = () => {
    trackEvent(guest.id, inviteCode, 'video_started')
  }

  const handleRSVP = (status: 'attending' | 'declined') => {
    setRsvpStatus(status)
    setScreen('confirmation')
  }

  const guestDisplayName = guest.partner_name
    ? `${guest.first_name} & ${guest.partner_name}`
    : guest.first_name

  return (
    <div className="grain relative w-full h-dvh overflow-hidden bg-[#050D1A]">
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
          onEnd={handleVideoEnd}
          onStart={handleVideoStart}
          onSkip={handleVideoEnd}
          active={screen === 'video'}
        />
      </div>

      {/* RSVP */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'rsvp' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <RSVPScreen
          guest={guest}
          guestName={guestDisplayName}
          onComplete={handleRSVP}
          active={screen === 'rsvp'}
        />
      </div>

      {/* Confirmation */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'confirmation' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <ConfirmationScreen
          guest={guest}
          guestName={guestDisplayName}
          status={rsvpStatus}
          onBack={() => setScreen('rsvp')}
        />
      </div>
    </div>
  )
}
