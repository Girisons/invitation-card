'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Guest, trackEvent, updateGuestStatus, submitRSVP } from '@/lib/supabase'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'

interface Props {
  guest: Guest
  inviteCode: string
}

export default function TeaserClient({ guest, inviteCode }: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [rsvpState, setRsvpState] = useState<'attending' | 'declined' | null>(null)
  const [saving, setSaving] = useState(false)

  const guestDisplayName = (guest.send_together && guest.partner_name)
    ? `${guest.first_name} & ${guest.partner_name}`
    : (guest.first_name || 'Honored Guest')

  useEffect(() => {
    trackEvent(guest.id, inviteCode, 'teaser_opened')
    updateGuestStatus(guest.id, 'entered')
  }, [guest.id, inviteCode])

  const toggleSound = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const video = videoRef.current
    const audio = audioRef.current
    if (video) {
      if (video.paused) {
        video.muted = false
        video.play().catch(() => { video.muted = true; video.play() })
        setMuted(false)
        setIsPlaying(true)
      } else {
        video.muted = !video.muted
        setMuted(video.muted)
      }
    }
    if (audio && EVENT.audioUrl) {
      if (audio.paused) {
        audio.src = EVENT.audioUrl
        audio.play().catch(() => {})
      }
    }
  }

  const handleCalendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    trackEvent(guest.id, inviteCode, 'calendar_clicked')
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      const ics = buildICSContent()
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'arpit40_diwali.ics'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      window.open(buildGoogleCalUrl(), '_blank')
    }
  }

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    trackEvent(guest.id, inviteCode, 'whatsapp_clicked')
    const link = `https://khandelwalinvite.vercel.app/t/${inviteCode}`
    const msg = `Four decades of beautiful memories, countless reasons to smile, and a heart full of stories. \uD83D\uDC96\n\nNow it's time to celebrate *${guestDisplayName}* at *Arpit's 40th Birthday & Diwali Celebration!* \u2728\nOn *Friday, 23rd October 2026* at *Jaipur*.\nCome watch the teaser & RSVP here: \uD83C\uDF89\uD83C\uDF1F\n\n\uD83D\uDC49 *Teaser Video Invitation:*\n${link}`
    let phone = (guest.mobile || '').replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone
    const targetUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(targetUrl, '_blank')
  }

  const handleYes = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    trackEvent(guest.id, inviteCode, 'rsvp_attending')
    await submitRSVP(guest.id, 'attending', guest.invited_count || 1)
    setRsvpState('attending')
    setSaving(false)
  }

  const handleNo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    trackEvent(guest.id, inviteCode, 'rsvp_declined')
    await submitRSVP(guest.id, 'declined', 0)
    setRsvpState('declined')
    setSaving(false)
  }

  return (
    <div className="relative w-full full-viewport-height bg-black overflow-hidden select-none" onClick={toggleSound}>
      {/* Video element */}
      <video
        ref={videoRef}
        src={guest.video_url || EVENT.videoUrl || '/videos/teaser.mp4'}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        preload="auto"
        poster={EVENT.poster || undefined}
        onPlay={() => setIsPlaying(true)}
      />
      {EVENT.audioUrl && <audio ref={audioRef} preload="auto" />}

      {/* Ambient Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 pointer-events-none" />

      {/* Main Overlay Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 z-20 pointer-events-none">
        
        {/* Header Pill */}
        <div className="w-full pt-2 flex justify-between items-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-[#C9A84C]/40 bg-[#050D1A]/80 backdrop-blur-md rounded-full">
            <span className="text-[#C9A84C] text-xs">🪔</span>
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#F5ECD7]">
              ARPIT'S 40TH & DIWALI TEASER
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/i/${inviteCode}`) }}
            className="px-3.5 py-1.5 glass border border-[#C9A84C]/50 text-[#C9A84C] text-[10px] font-sans font-bold tracking-[0.15em] uppercase rounded-full hover:bg-[#C9A84C]/15 transition-all"
          >
            Full Card ✉️
          </button>
        </div>

        {/* Center Stage Card */}
        <div className="relative w-full flex-1 flex flex-col items-center justify-center text-center pointer-events-none">
          <div className="max-w-md w-full px-4 flex flex-col items-center">
            
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C] mb-2 font-medium">
              DIWALI VIBES · 40 YEARS · MEMORIES
            </p>
            
            <h1 className="font-serif font-bold text-3xl sm:text-5xl text-[#F5ECD7] mb-2 tracking-wide uppercase leading-tight drop-shadow-lg">
              {guestDisplayName}
            </h1>
            
            <h3 className="font-serif text-lg sm:text-2xl text-[#C9A84C] font-semibold mb-1">
              FRIDAY | OCT 23, 2026
            </h3>
            
            <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/70 mb-6">
              JAIPUR · RAJASTHAN
            </p>

            {/* RSVP Status Banner if completed */}
            {rsvpState && (
              <div className="mb-4 px-4 py-2 rounded-full border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-sans font-semibold tracking-wider uppercase">
                ✓ RSVP Confirmed: {rsvpState === 'attending' ? "YES, I'LL BE THERE 🎉" : "SORRY, CAN'T MAKE IT 🙏"}
              </div>
            )}

            {/* Interactive Action Controls */}
            <div className="flex flex-col gap-2.5 w-full max-w-xs pointer-events-auto">
              {!rsvpState ? (
                <>
                  <button
                    onClick={handleYes}
                    disabled={saving}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white font-sans font-bold text-xs tracking-[0.2em] uppercase rounded-sm shadow-xl shadow-[#C9A84C]/25 hover:brightness-110 active:scale-95 transition-all"
                  >
                    {saving ? 'Saving…' : "YES, I'LL BE THERE"}
                  </button>

                  <button
                    onClick={handleNo}
                    disabled={saving}
                    className="w-full py-3 px-6 glass border border-white/20 text-[#F5ECD7]/80 font-sans font-medium text-xs tracking-[0.2em] uppercase rounded-sm hover:border-white/50 hover:text-white active:scale-95 transition-all opacity-85 hover:opacity-100"
                  >
                    {saving ? 'Saving…' : "SORRY, CAN'T MAKE IT"}
                  </button>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleCalendar}
                  className="py-2.5 px-3 glass border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#F5ECD7] font-sans font-semibold text-[10px] sm:text-xs tracking-[0.15em] uppercase rounded-sm hover:bg-[#C9A84C]/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📅</span> Calendar
                </button>

                <button
                  onClick={handleWhatsAppShare}
                  className="py-2.5 px-3 glass border border-green-500/40 bg-green-500/10 text-green-400 font-sans font-semibold text-[10px] sm:text-xs tracking-[0.15em] uppercase rounded-sm hover:bg-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>💬</span> WhatsApp
                </button>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/i/${inviteCode}`) }}
                className="w-full py-2.5 px-4 glass border border-white/10 text-white/50 hover:text-white font-sans text-[10px] tracking-[0.2em] uppercase rounded-sm hover:border-white/30 transition-all mt-1"
              >
                Open Full Card Invitation ✉️
              </button>
            </div>

          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="w-full pb-2 flex justify-between items-center pointer-events-auto">
          <button
            onClick={toggleSound}
            className="glass px-3.5 py-2 rounded-full border border-[#C9A84C]/40 flex items-center gap-1.5 hover:bg-[#C9A84C]/10 transition-all active:scale-95 animate-pulse"
          >
            <span className="text-amber-400 text-xs">{muted ? '🔇' : '🔊'}</span>
            <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-[#C9A84C]">
              {muted ? 'Tap for Sound' : 'Sound On'}
            </span>
          </button>

          <button
            onClick={handleCalendar}
            className="glass px-3.5 py-2 rounded-full border border-[#C9A84C]/60 bg-[#C9A84C]/15 flex items-center gap-1.5 hover:bg-[#C9A84C]/30 text-[#F5ECD7] transition-all active:scale-95 shadow-md shadow-[#C9A84C]/10"
          >
            <span className="text-xs">📅</span>
            <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-[#C9A84C] font-bold">
              Add to Calendar
            </span>
          </button>
        </div>

      </div>
    </div>
  )
}
