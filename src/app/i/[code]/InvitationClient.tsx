'use client'

import { useState, useEffect } from 'react'
import { Guest, trackEvent, updateGuestStatus, submitRSVP, updateGuestInviteDetails, parseGuestNotes } from '@/lib/supabase'
import OpeningScreen from '@/components/OpeningScreen'
import VideoScreen from '@/components/VideoScreen'
import ConfirmationScreen from '@/components/ConfirmationScreen'
import InstaScreen from '@/components/InstaScreen'

type Screen = 'opening' | 'video' | 'confirmation'

interface Props {
  guest: Guest
  inviteCode: string
  inviteType?: string
}

export default function InvitationClient({ guest, inviteCode, inviteType }: Props) {
  const isInstaSoiree = inviteType === 'insta_soiree' || inviteType === 'soiree_insta' || inviteType === 'insta_diwali'
  const isInsta40 = inviteType === 'insta' || inviteType === 'instagram' || inviteType === '40andfestive'
  const isInsta = isInstaSoiree || isInsta40
  if (isInsta) {
    return <InstaScreen guest={guest} inviteCode={inviteCode} theme={isInstaSoiree ? 'soiree' : '40_festive'} />
  }

  const [screen, setScreen] = useState<Screen>('video')
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'declined' | null>(null)

  const isDiwaliSaveDate = inviteType === 'save_date_diwali' || inviteType === 'std_diwali' || inviteType === 'diwali' || inviteType === 'save-date-diwali'
  const isDiwaliMain = inviteType === 'main_diwali' || inviteType === 'invite_diwali' || inviteType === 'diwali_main' || inviteType === 'diwali_invite'
  const isDiwali = isDiwaliSaveDate || isDiwaliMain
  const isSaveTheDate = isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date'
  const activeVideoUrl = isDiwaliSaveDate
    ? (guest.std_video_url || '/videos/save-the-date-diwali.mp4')
    : isDiwaliMain
    ? (guest.video_url || '/videos/main-invite.mp4')
    : isSaveTheDate
    ? (guest.std_video_url || '/videos/save-the-date.mp4')
    : (guest.video_url || '/videos/main-invite.mp4')

  // Track invitation opened & entered video directly and update specific invite status
  useEffect(() => {
    trackEvent(guest.id, inviteCode, isDiwali ? 'diwali_opened' : isSaveTheDate ? 'std_opened' : 'invitation_opened')
    trackEvent(guest.id, inviteCode, isDiwali ? 'diwali_entered' : isSaveTheDate ? 'std_entered' : 'invitation_entered')
    updateGuestStatus(guest.id, 'entered')

    if (isSaveTheDate) {
      updateGuestInviteDetails(guest.id, {
        std_status: 'seen',
        std_type: isDiwali ? 'diwali' : '40_festive'
      })
    } else {
      const currentNotes = parseGuestNotes(guest.notes)
      // Only mark main invite as seen if it was previously sent by the hosts
      if (currentNotes.main_status === 'sent') {
        updateGuestInviteDetails(guest.id, {
          main_status: 'seen',
          main_type: isDiwali ? 'diwali' : (currentNotes.main_type || '40_festive')
        })
      }
    }
  }, [guest.id, inviteCode, isSaveTheDate, isDiwali, isDiwaliSaveDate, isDiwaliMain])

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
    <>
      {activeVideoUrl && (
        <link rel="preload" as="video" href={activeVideoUrl} type="video/mp4" />
      )}
      <div
        className="grain relative w-full full-viewport-height overflow-y-auto overflow-x-hidden touch-pan-y bg-[#050D1A]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Opening — always rendered, hidden when not active */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'opening' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <OpeningScreen
          guestName={guestDisplayName}
          onEnter={handleEnter}
          isDiwali={isDiwali}
        />
      </div>

      {/* Video */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${screen === 'video' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}>
        <VideoScreen
          guestName={guestDisplayName}
          guestId={guest.id}
          videoUrl={activeVideoUrl}
          inviteCode={guest.invite_code}
          inviteType={inviteType}
          isDiwali={isDiwali}
          isSaveTheDate={isSaveTheDate}
          prevRsvpStatus={guest.prev_rsvp_status || 'pending'}
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
          inviteType={inviteType}
          onBack={() => setScreen('video')}
        />
      </div>
    </div>
  </>
  )
}
