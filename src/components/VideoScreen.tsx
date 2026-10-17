'use client'

import { useEffect, useRef, useState } from 'react'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'
import { trackEvent } from '@/lib/supabase'

interface Props {
  guestName?: string
  guestId?: string
  videoUrl?: string
  inviteCode?: string
  inviteType?: string
  isDiwali?: boolean
  isSaveTheDate?: boolean
  onSelectYes: () => void
  onSelectNo: () => void
  onStart: () => void
  active: boolean
}

export default function VideoScreen({
  guestName,
  guestId,
  videoUrl: customVideoUrl,
  inviteCode,
  inviteType,
  isDiwali,
  isSaveTheDate,
  onSelectYes,
  onSelectNo,
  onStart,
  active
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoState, setVideoState] = useState<'loading' | 'playing' | 'ended' | 'unavailable'>('loading')
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(10)
  const [showSkip, setShowSkip] = useState(false)
  const [soundMuted, setSoundMuted] = useState(true)
  const [hasTappedSound, setHasTappedSound] = useState(false)
  const [soundPromptVisible, setSoundPromptVisible] = useState(true)
  const startedRef = useRef(false)
  const endedCalledRef = useRef(false)
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const endTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showRsvpPrompt, setShowRsvpPrompt] = useState(false)

  const isDiwaliSaveDate = Boolean(
    inviteType === 'save_date_diwali' ||
    inviteType === 'std_diwali' ||
    inviteType === 'diwali' ||
    inviteType === 'save-date-diwali'
  )
  const isDiwaliEvent = Boolean(isDiwali || isDiwaliSaveDate || (inviteType && inviteType.includes('diwali')))
  const isSaveDate = Boolean(isSaveTheDate || isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date')
  const isMainInvite = !isSaveDate
  const targetUrl = customVideoUrl || (isSaveDate ? (isDiwaliEvent ? '/videos/save-the-date-diwali.mp4' : '/videos/save-the-date.mp4') : '/videos/main-invite.mp4')
  const hasVideo = Boolean(targetUrl && targetUrl.trim().length > 0)
  const hasBurnedText = isSaveDate

  function formatGuestTitleCase(name?: string): string {
    if (!name || !name.trim()) return 'Honored Guest'
    return name
      .trim()
      .split(' ')
      .map(word => {
        if (word.toUpperCase() === '&' || word.toLowerCase() === 'and') return '&'
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
  }

  // Calendar handle
  const handleCalendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (guestId) trackEvent(guestId, inviteCode || '', 'calendar_clicked')
    const isDiwaliEvent = Boolean(isDiwali || inviteType?.includes('diwali'))
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
      const ics = buildICSContent(isDiwaliEvent)
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isDiwaliEvent ? 'diwali-celebration.ics' : 'arpit40.ics'
      a.click()
    } else {
      window.open(buildGoogleCalUrl(isDiwaliEvent), '_blank')
    }
  }

  // Skip video to reveal RSVP CTAs immediately
  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    const video = videoRef.current
    if (video) video.pause()
    endedCalledRef.current = true
    setVideoState('ended')
    setShowRsvpPrompt(true)
  }

  useEffect(() => {
    if (!active) {
      setShowRsvpPrompt(false)
      startedRef.current = false
      endedCalledRef.current = false
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      return
    }

    if (!hasVideo) {
      setVideoState('ended')
      setShowRsvpPrompt(true)
      setSoundPromptVisible(false)
      return
    }

    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.defaultMuted = true
    // Aggressively pre-buffer the video frames so tap has 0s latency
    video.load()

    // Show skip button after 2 seconds guaranteed
    const skipTimer = setTimeout(() => setShowSkip(true), 2000)

    // For Save The Date, keep auto-dismiss. For Main Invite, stay on the gate until guest taps!
    if (!isMainInvite) {
      autoPlayTimerRef.current = setTimeout(() => {
        setSoundPromptVisible(false)
        if (video) {
          video.muted = false
          const playPromise = video.play()
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setSoundMuted(false)
              setVideoState('playing')
              if (!startedRef.current) {
                startedRef.current = true
                onStart()
              }
            }).catch(() => {
              video.muted = true
              video.play().then(() => {
                setSoundMuted(true)
                setVideoState('playing')
                if (!startedRef.current) {
                  startedRef.current = true
                  onStart()
                }
              }).catch((err) => {
                console.warn('Autoplay restricted:', err)
                setVideoState('playing')
              })
            })
          }
        }
      }, 3000)
    }

    // Fallback ticker timer to advance currentTime once video starts
    const fallbackTicker = setInterval(() => {
      if (video && !video.paused && video.currentTime > 0) {
        setCurrentTime(video.currentTime)
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration)
        }
      } else if (startedRef.current) {
        // Increment timer synthetically if video is playing but stuck
        setCurrentTime((prev) => {
          const next = prev + 0.25
          if (next >= duration && !endedCalledRef.current) {
            endedCalledRef.current = true
            setVideoState('ended')
            if (endTimerRef.current) clearTimeout(endTimerRef.current)
            endTimerRef.current = setTimeout(() => {
              setShowRsvpPrompt(true)
            }, 2500)
          }
          return next
        })
      }
    }, 250)

    const handleTimeUpdate = () => {
      if (video && !isNaN(video.currentTime)) {
        setCurrentTime(video.currentTime)
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration)
        }
      }
    }

    const handleEnded = () => {
      if (endedCalledRef.current) return
      endedCalledRef.current = true
      setVideoState('ended')

      // User constraint: Wait 2.5 seconds after video ends before presenting RSVP buttons
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      endTimerRef.current = setTimeout(() => {
        setShowRsvpPrompt(true)
      }, 2500)
    }

    const handleError = (e: Event) => {
      console.warn('Video load error:', e)
      setVideoState('unavailable')
      setShowRsvpPrompt(true)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      clearTimeout(skipTimer)
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      clearInterval(fallbackTicker)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.pause()
    }
  }, [active, customVideoUrl, duration, onStart])

  // Handle user interaction (tap card or screen to start video immediately WITH AUDIO)
  const handleUserInteraction = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setHasTappedSound(true)
    setSoundPromptVisible(false)
    setSoundMuted(false)

    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current)
      autoPlayTimerRef.current = null
    }

    const video = videoRef.current

    if (video) {
      video.muted = false
      video.volume = 1.0
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          video.muted = false
          setSoundMuted(false)
          setVideoState('playing')
          if (!startedRef.current) {
            startedRef.current = true
            onStart()
          }
        }).catch((err) => {
          console.warn('Unmuted play blocked by browser, trying fallback:', err)
          video.muted = true
          video.play().then(() => {
            setSoundMuted(true)
            setVideoState('playing')
            if (!startedRef.current) {
              startedRef.current = true
              onStart()
            }
          }).catch(() => {})
        })
      }
    }
  }

  // Teaser Beat calculations based on current time and total video duration
  const beat1End = duration ? duration * 0.33 : 3.3
  const beat2End = duration ? duration * 0.66 : 6.6

  const isBeat1 = videoState !== 'ended' && currentTime < beat1End
  const isBeat2 = videoState !== 'ended' && currentTime >= beat1End && currentTime < beat2End
  // Pathway Overlay (04s - 08s) on Main Invite
  const isPathwayBeat = isMainInvite && videoState === 'playing' && currentTime >= 4.0 && currentTime <= 8.0
  // Stage LED Backdrop Overlay (40s - 42s) on Main Invite
  const isStageBeat = isMainInvite && videoState === 'playing' && currentTime >= 40.0 && currentTime <= 42.0
  // Beat 3 (RSVP Buttons): only appears 2.5 seconds AFTER video ends (or if explicitly skipped, or immediately if video is unlinked)
  const isBeat3 = !hasVideo || showRsvpPrompt

  return (
    <div
      className="relative w-full full-viewport-height bg-black overflow-hidden select-none cursor-pointer"
      onClick={handleUserInteraction}
    >
      {/* Video Element */}
      {hasVideo ? (
        <video
          ref={videoRef}
          src={targetUrl}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          muted={soundMuted}
          poster={EVENT.poster || undefined}
          onEnded={() => {
            if (endedCalledRef.current) return
            endedCalledRef.current = true
            setVideoState('ended')
            if (endTimerRef.current) clearTimeout(endTimerRef.current)
            endTimerRef.current = setTimeout(() => {
              setShowRsvpPrompt(true)
            }, 2500)
          }}
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full bg-[#050D1A]"
          style={{
            background: 'radial-gradient(ellipse at 50% 35%, rgba(201,168,76,0.18) 0%, rgba(139,26,40,0.12) 45%, #050D1A 100%)'
          }}
        >
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-40 blur-3xl bg-amber-500/10" />
        </div>
      )}

      {/* Dark Vignette Overlay for Crisp Typography Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/80 pointer-events-none" />

      {/* Dimming overlay when RSVP buttons appear (2.5s after video ends) */}
      <div
        className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-1000 pointer-events-none z-10 ${
          isBeat3 ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── EMBOSSED GATE SCREEN (DESIGN 1: ROYAL MARCELLUS) OR FALLBACK TAP FOR SOUND ── */}
      {hasVideo && soundPromptVisible && (
        <div
          onClick={handleUserInteraction}
          className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer p-4 transition-all duration-500 animate-fadeIn"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.88) 100%)'
          }}
        >
          {isMainInvite ? (
            /* DESIGN 1: ROYAL MARCELLUS ON CLOSED GATE */
            <div className="flex flex-col items-center justify-center text-center max-w-xl w-full select-none px-4">
              {/* Tagline with Gold Diamonds */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#C9A84C] text-[10px]">❖</span>
                <p
                  className="font-marcellus text-[11px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C] font-semibold"
                  style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 -1px 0.5px rgba(255,249,210,0.5))' }}
                >
                  A PERSONAL INVITATION
                </p>
                <span className="text-[#C9A84C] text-[10px]">❖</span>
              </div>

              {/* Guest Name in Marcellus Title Case (Without "Hi") */}
              <h2
                className="font-marcellus text-3xl sm:text-5xl font-bold tracking-wide mb-3 leading-tight px-2"
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF0BD 35%, #E2B755 75%, #9C6F16 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.95)) drop-shadow(0 -1px 0.8px rgba(255,247,208,0.5))',
                }}
              >
                {formatGuestTitleCase(guestName)}
              </h2>

              {/* Carved Gold Inlay Divider with Center Pearl Dot */}
              <div className="relative w-48 sm:w-72 h-[3px] my-3 flex items-center justify-center">
                <div className="absolute inset-0 bg-[#000000] translate-y-[1.5px] opacity-80 blur-[0.5px]" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent h-[1.6px]" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF5BD] to-transparent -translate-y-[1px] h-[0.8px] opacity-50" />
                <div className="relative z-10 w-2 h-2 rounded-full bg-[#FFF5BD] shadow-[0_0_6px_rgba(201,168,76,0.8)]" />
              </div>

              {/* BIG: THE NIGHT AWAITS (Monumental 3D Embossed Marcellus) */}
              <h1
                className="font-marcellus text-4xl sm:text-6xl md:text-7xl font-bold tracking-[0.14em] uppercase my-2 leading-tight"
                style={{
                  background: 'linear-gradient(180deg, #FFFDF5 0%, #FCE18F 25%, #D4A63B 60%, #7A540D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.98)) drop-shadow(0 -1.8px 1px rgba(255,255,255,0.7)) drop-shadow(0 0 16px rgba(212,166,59,0.45))',
                }}
              >
                THE NIGHT AWAITS
              </h1>

              {/* Event Subtitle */}
              <p
                className="font-marcellus text-[11px] sm:text-xs font-semibold tracking-[0.35em] uppercase text-[#E8D5A3] my-4"
                style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95))' }}
              >
                {isDiwaliEvent ? 'KHANDELWAL DIWALI CELEBRATION' : "ARPIT'S 40TH BIRTHDAY & DIWALI CELEBRATION"}
              </p>

              {/* Antique Brass Plaque Button: TAP TO ENTER */}
              <button
                type="button"
                onClick={handleUserInteraction}
                className="group relative mt-2 px-9 py-3.5 rounded-full border border-[#AA822E] bg-gradient-to-b from-[#1A1108] to-[#0D0804] text-[#FFF6D6] shadow-[0_4px_20px_rgba(0,0,0,0.9),0_0_20px_rgba(170,130,46,0.25)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.9),0_0_30px_rgba(170,130,46,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 pointer-events-auto"
                style={{
                  boxShadow: '0 4px 20px rgba(0,0,0,0.9), 0 0 25px rgba(170,130,46,0.3), inset 0 0 0 1px rgba(255,234,160,0.4)'
                }}
              >
                <span className="font-marcellus text-xs sm:text-sm font-bold tracking-[0.25em] uppercase flex items-center gap-2">
                  <span>TAP TO ENTER</span>
                  <span className="transition-transform group-hover:translate-x-1">➔</span>
                </span>
              </button>
            </div>
          ) : (
            /* Fallback for Save The Date */
            <div className="flex flex-col items-center justify-center text-center px-8 py-10 rounded-2xl border-2 border-[#C9A84C] bg-[#050D1A]/95 text-[#F5ECD7] shadow-[0_0_60px_rgba(201,168,76,0.6)] hover:scale-105 active:scale-95 transition-all max-w-xs w-full">
              <div className="w-20 h-20 rounded-full border-2 border-[#C9A84C]/80 bg-[#C9A84C]/10 flex items-center justify-center mb-6 shadow-inner">
                <span className="text-4xl text-amber-400">🔊</span>
              </div>
              <h2 className="font-serif text-2xl font-bold tracking-wider text-[#FFF6D6] mb-3 uppercase">
                TAP FOR SOUND
              </h2>
              <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-[#C9A84C] font-semibold">
                {isDiwali ? 'KHANDELWAL DIWALI BASH' : "ARPIT'S 40TH & DIWALI CELEBRATION"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MOVIE TEASER DYNAMIC TEXT OVERLAY SEQUENCE ── */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 pointer-events-none z-20">

        {/* Top Header — Skip to RSVP button */}
        <div className="w-full pt-4 px-2 flex justify-end pointer-events-auto z-30 min-h-[44px]">
          {videoState === 'playing' && showSkip && !isBeat3 && (
            <button
              onClick={handleSkip}
              className="glass px-3.5 py-1.5 rounded-full border border-[#C9A84C]/40 text-[10px] font-sans font-semibold tracking-[0.2em] uppercase text-[#F5ECD7]/80 hover:text-white hover:border-[#C9A84C] hover:bg-[#C9A84C]/15 transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-black/50"
            >
              <span>Skip to RSVP</span>
              <span className="text-xs">⏭</span>
            </button>
          )}
        </div>

        {/* CENTER STAGE: SEQUENTIAL TEASER BEATS */}
        <div className="relative w-full flex-1 flex flex-col items-center justify-center text-center">

          {/* BEAT 1: Opening Title Reveal (Suppressed if video already has burned text or for main invite) */}
          {!hasBurnedText && !isMainInvite && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
              isBeat1 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
            }`}>
              <p className="font-sans text-[10px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C]/80 mb-3">
                {isDiwali ? 'FESTIVAL OF LIGHTS' : 'A TIMELESS CELEBRATION'}
              </p>
              <h1
                className="font-serif font-bold text-4xl sm:text-6xl tracking-tight mb-3 leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #FFF6D6 0%, #E8D5A3 40%, #C9A84C 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 35px rgba(201,168,76,0.6))',
                }}
              >
                {isDiwali ? 'Diwali Party' : '40 & Festive'}
              </h1>
              <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent my-3" />
              <p className="font-sans text-xs sm:text-sm tracking-[0.3em] uppercase text-[#F5ECD7]/80 font-medium">
                {isDiwali ? 'A GRAND CELEBRATION' : "ARPIT'S 40TH & DIWALI BASH"}
              </p>
            </div>
          )}

          {/* BEAT 2: Personalized Guest Card (Shown for Save The Date, suppressed for main invite where guest saw it on gate) */}
          {(!hasBurnedText || isDiwali) && !isMainInvite && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
              isBeat2 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
            }`}>
              <p className="font-sans text-[10px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C]/90 mb-4 font-semibold">
                {isDiwali ? 'A PERSONAL INVITATION FOR' : 'A FESTIVE WELCOME TO'}
              </p>
              <h2
                className="font-serif font-bold text-3xl sm:text-5xl tracking-wide uppercase mb-4 px-4 leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5ECD7 50%, #E8D5A3 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.8))',
                }}
              >
                {guestName || 'HONORED GUEST'}
              </h2>
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#C9A84C]/60 bg-[#050D1A]/85 backdrop-blur-md rounded-full shadow-lg shadow-[#C9A84C]/15">
                <span className="text-[#C9A84C] text-xs">{isDiwali ? '✨' : '🪔'}</span>
                <span className="font-sans text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-[#F5ECD7]/95 font-bold">
                  {isDiwali ? 'JOIN US IN THE LIGHT' : 'JOIN US TO CELEBRATE 40 YEARS OF LIGHT'}
                </span>
              </div>
            </div>
          )}

          {/* ── PATHWAY OVERLAY (04s - 08s): ONE NIGHT. TWO REASONS TO CELEBRATE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 pointer-events-none select-none px-6 text-center z-20 ${
                isPathwayBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              {/* Top delicate gold stars */}
              <div className="flex items-center gap-3 text-[#D4AF37] text-xs sm:text-sm tracking-[0.4em] mb-3 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                <span>✦</span>
                <span className="text-[10px]">❖</span>
                <span>✦</span>
              </div>

              {/* Title: ONE NIGHT. TWO REASONS TO CELEBRATE */}
              <h2
                className="font-marcellus text-2xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">ONE NIGHT. </span>
                <span className="block sm:inline">TWO REASONS TO CELEBRATE</span>
              </h2>

              {/* Carved Gold Inlay Divider */}
              <div className="flex items-center justify-center w-48 sm:w-72 mt-4 opacity-85">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFF2BD] mx-2 shadow-[0_0_6px_rgba(201,168,76,0.8)]" />
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
              </div>
            </div>
          )}

          {/* ── STAGE LED BACKDROP OVERLAY (40s - 42s): WHEN THE NIGHT COMES ALIVE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isStageBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
              style={{
                transform: 'translateY(-10%)',
              }}
            >
              {/* Top delicate gold stars */}
              <div className="flex items-center gap-3 text-[#FFF2BD] text-xs sm:text-sm tracking-[0.4em] mb-2 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                <span>✦</span>
                <span className="text-[10px]">❖</span>
                <span>✦</span>
              </div>

              {/* Title: WHEN THE NIGHT COMES ALIVE */}
              <h2
                className="font-marcellus text-2xl sm:text-4xl md:text-5xl font-bold tracking-[0.18em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(180deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #8C6314 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                WHEN THE NIGHT COMES ALIVE
              </h2>

              {/* Gold underline */}
              <div className="flex items-center justify-center w-44 sm:w-64 mt-3 opacity-85">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFF2BD] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFF2BD] mx-2 shadow-[0_0_6px_rgba(201,168,76,0.8)]" />
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFF2BD] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
              </div>
            </div>
          )}

          {/* BEAT 3: Climax & Interactive CTAs */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            {isDiwali ? (
              <div className="flex flex-col items-center text-center px-4 max-w-sm mb-4">
                <div className="text-amber-400 text-3xl mb-2 flame-animate" style={{ filter: 'drop-shadow(0 0 16px rgba(232,129,10,0.9))' }}>
                  🪔
                </div>
                <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/90 mb-1 font-semibold">
                  FESTIVAL OF LIGHTS
                </p>
                <h2
                  className="font-serif font-bold text-2xl sm:text-3xl text-[#F5ECD7] mb-2 leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #FFF6D6 0%, #E8D5A3 50%, #C9A84C 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Diwali Party Celebration
                </h2>
                <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent my-1.5" />
                <p className="font-serif italic text-sm sm:text-base text-[#F5ECD7]/90 mb-1">
                  {guestName ? `A Warm Invitation For ${formatGuestTitleCase(guestName)}` : 'A Warm Invitation For You'}
                </p>
                <p className="font-sans text-xs tracking-[0.25em] uppercase text-[#C9A84C] font-semibold mb-1">
                  Friday, 23rd October 2026 · Jaipur
                </p>
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/50 mb-2">
                  Drinks · Dance · Celebration
                </p>
              </div>
            ) : (!hasBurnedText) && (
              <>
                <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/90 mb-2">
                  DIWALI VIBES • FAB 40 • MEMORIES
                </p>
                <h3 className="font-serif text-2xl sm:text-4xl text-[#F5ECD7] font-bold mb-2">
                  FRIDAY | OCT 23, 2026
                </h3>
                <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/60 mb-6">
                  JAIPUR · RAJASTHAN
                </p>
              </>
            )}

            {/* Interactive CTAs — Direct Yes / No / Calendar Buttons */}
            <div className="flex flex-col gap-2.5 w-full max-w-xs px-4">
              <button
                onClick={(e) => { e.stopPropagation(); onSelectYes() }}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white font-sans font-bold text-xs tracking-[0.2em] uppercase rounded-sm shadow-xl shadow-[#C9A84C]/25 hover:brightness-110 active:scale-95 transition-all"
              >
                YES, I'LL BE THERE
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSelectNo() }}
                className="w-full py-3.5 px-6 glass border border-white/20 text-[#F5ECD7]/80 font-sans font-medium text-xs tracking-[0.2em] uppercase rounded-sm hover:border-white/50 hover:text-white active:scale-95 transition-all opacity-85 hover:opacity-100"
              >
                SORRY, CAN'T MAKE IT
              </button>
              <button
                onClick={handleCalendar}
                className="w-full py-3 px-6 glass border border-[#C9A84C]/40 text-[#C9A84C] font-sans font-medium text-xs tracking-[0.2em] uppercase rounded-sm hover:bg-[#C9A84C]/10 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>📅</span> {isDiwali ? 'ADD TO CALENDAR' : 'ADD TO CALENDAR'}
              </button>
            </div>
            {isDiwali && (
              <p className="font-serif italic text-xs text-[#F5ECD7]/50 mt-4">
                Warmly, The Khandelwal Family
              </p>
            )}
          </div>

        </div>

        {/* BOTTOM NAVIGATION BAR */}
        {hasVideo && (
          <div className="w-full pb-4 flex justify-between items-center pointer-events-auto gap-2">
            <button
              onClick={handleUserInteraction}
              className="glass px-3.5 py-2 rounded-full border border-[#C9A84C]/40 flex items-center gap-1.5 hover:bg-[#C9A84C]/10 transition-all active:scale-95 animate-pulse"
            >
              <span className="text-amber-400 text-xs">{soundMuted ? '🔇' : '🔊'}</span>
              <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-[#C9A84C]">
                {soundMuted ? 'Tap for Sound' : 'Sound On'}
              </span>
            </button>

            {!isBeat3 && (
              <button
                onClick={handleCalendar}
                className="glass px-3.5 py-2 rounded-full border border-[#C9A84C]/60 bg-[#C9A84C]/15 flex items-center gap-1.5 hover:bg-[#C9A84C]/30 text-[#F5ECD7] transition-all active:scale-95 shadow-md shadow-[#C9A84C]/10"
              >
                <span className="text-xs">📅</span>
                <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-[#C9A84C] font-bold">
                  Add to Calendar
                </span>
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
