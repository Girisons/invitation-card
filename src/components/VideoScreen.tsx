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
  prevRsvpStatus?: 'attending' | 'declined' | 'pending'
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
  prevRsvpStatus = 'pending',
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
  const [soundMuted, setSoundMuted] = useState(false)
  const [hasTappedSound, setHasTappedSound] = useState(false)
  const [soundPromptVisible, setSoundPromptVisible] = useState(true)
  const [rotatePromptActive, setRotatePromptActive] = useState(true)
  const [rotateCountdown, setRotateCountdown] = useState(5)
  const startedRef = useRef(false)
  const endedCalledRef = useRef(false)
  const endTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showRsvpPrompt, setShowRsvpPrompt] = useState(false)
  const onStartRef = useRef(onStart)
  const containerRef = useRef<HTMLDivElement>(null)
  const festiveOverlayRef = useRef<HTMLDivElement>(null)
  const stageOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onStartRef.current = onStart
  }, [onStart])

  // Live Digital Countdown to Grand Celebration (Friday, Oct 23, 2026, 8:00 PM IST)
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  useEffect(() => {
    const targetTime = new Date('2026-10-23T20:00:00+05:30').getTime()
    const updateCountdown = () => {
      const now = Date.now()
      const diff = Math.max(0, targetTime - now)
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      })
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [])

  const isDiwaliSaveDate = Boolean(
    inviteType === 'save_date_diwali' ||
    inviteType === 'std_diwali' ||
    inviteType === 'diwali' ||
    inviteType === 'save-date-diwali'
  )
  const isDiwaliEvent = Boolean(isDiwali || isDiwaliSaveDate || (inviteType && inviteType.includes('diwali')))
  const isSaveDate = Boolean(isSaveTheDate || isDiwaliSaveDate || inviteType === 'save_date' || inviteType === 'std' || inviteType === 'save-the-date')
  const isMainInvite = !isSaveDate

  // Show 5-sec rotate phone prompt before TAP TO ENTER on initial load (Main Invite only)
  useEffect(() => {
    if (!active || !isMainInvite) {
      setRotatePromptActive(false)
      return
    }

    setRotatePromptActive(true)
    setRotateCountdown(5)
  }, [active, isMainInvite])

  // Countdown timer and live physical rotation detection
  useEffect(() => {
    if (!rotatePromptActive) return

    const handleOrientationChange = () => {
      // If mobile device is physically rotated to landscape, dismiss immediately
      if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerWidth <= 900) {
        setRotatePromptActive(false)
      }
    }

    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    const timer = setInterval(() => {
      setRotateCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setRotatePromptActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [rotatePromptActive])
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
      const video = videoRef.current
      if (video) video.pause()
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

    // Show skip button after 2 seconds guaranteed
    const skipTimer = setTimeout(() => setShowSkip(true), 2000)

    const handleLoadedMetadata = () => {
      if (video && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
    }

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
      video.pause()
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

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    // Ticker to sync currentTime smoothly
    const ticker = setInterval(() => {
      if (video && !video.paused && !isNaN(video.currentTime)) {
        setCurrentTime(video.currentTime)
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration)
        }
      }
    }, 250)

    // 60fps tracking animation for scene overlays on main invite
    let rafId: number
    const updateSceneTransforms = () => {
      if (video) {
        const t = video.currentTime

        // 1. More Meaningful Because of You (19.0s - 22.0s): moves along with camera and fades
        const festiveEl = festiveOverlayRef.current
        if (festiveEl) {
          if (t < 19.0 || t > 22.0 || video.paused) {
            if (t < 19.0 || t > 22.0) {
              festiveEl.style.opacity = '0'
            }
          } else {
            let opacity = 1
            let fadeUpY = 0
            if (t < 19.5) {
              opacity = Math.max(0, Math.min(1, (t - 19.0) / 0.5))
            } else if (t > 21.2) {
              const outProg = Math.max(0, Math.min(1, (t - 21.2) / 0.8))
              opacity = 1 - outProg
              fadeUpY = -outProg * 3.5
            }

            // Move along the camera: forward dolly scale and subtle perspective glide
            const progress = Math.max(0, Math.min(1, (t - 19.0) / 3.0))
            const scale = 0.90 + progress * 0.22
            const translateY = 0 + fadeUpY

            festiveEl.style.opacity = opacity.toFixed(3)
            festiveEl.style.transform = `translate3d(0vw, ${translateY.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`
          }
        }

        // 2. LED Stage Screen (25.2s - 29.5s): Rock-solid locked in the center of the LED screen (NO dancing/moving)
        const stageEl = stageOverlayRef.current
        if (stageEl) {
          if (t < 25.2 || t > 29.5 || video.paused) {
            if (stageEl.style.opacity !== '0') {
              stageEl.style.opacity = '0'
            }
          } else {
            let opacity = 1
            if (t < 25.8) {
              opacity = Math.max(0, Math.min(1, (t - 25.2) / 0.6))
            } else if (t > 28.8) {
              const fadeOutProgress = Math.max(0, Math.min(1, (t - 28.8) / 0.6))
              opacity = 1 - fadeOutProgress
            }
            stageEl.style.opacity = opacity.toFixed(3)
          }
        }

      }
      rafId = requestAnimationFrame(updateSceneTransforms)
    }
    rafId = requestAnimationFrame(updateSceneTransforms)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(skipTimer)
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      clearInterval(ticker)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [active, targetUrl, hasVideo])

  // Guarantee background video stays completely stopped once end / RSVP screen is reached
  useEffect(() => {
    if (showRsvpPrompt || videoState === 'ended') {
      const video = videoRef.current
      if (video && !video.paused) {
        video.pause()
      }
    }
  }, [showRsvpPrompt, videoState])

  // Handle user interaction (tap card or screen to start video immediately WITH AUDIO)
  const handleUserInteraction = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation()
    }
    // Never restart or play video once it has already started or reached the RSVP end screen
    if (endedCalledRef.current || videoState === 'ended' || showRsvpPrompt || !soundPromptVisible) {
      return
    }
    setHasTappedSound(true)
    setSoundPromptVisible(false)

    const video = videoRef.current
    if (video) {
      video.muted = false
      video.defaultMuted = false
      video.volume = 1.0

      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            video.muted = false
            setSoundMuted(false)
            setVideoState('playing')
            if (!startedRef.current) {
              startedRef.current = true
              onStartRef.current()
            }
          })
          .catch((err) => {
            console.warn('Unmuted play blocked by browser, trying fallback:', err)
            video.muted = true
            setSoundMuted(true)
            video.play()
              .then(() => {
                setVideoState('playing')
                if (!startedRef.current) {
                  startedRef.current = true
                  onStartRef.current()
                }
              })
              .catch((err2) => {
                console.error('Video play error:', err2)
              })
          })
      }
    }
  }

  const toggleSound = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setSoundMuted(nextMuted)
  }

  // Teaser Beat calculations based on current time and total video duration
  const beat1End = duration ? duration * 0.33 : 3.3
  const beat2End = duration ? duration * 0.66 : 6.6

  const isBeat1 = videoState !== 'ended' && currentTime < beat1End
  const isBeat2 = videoState !== 'ended' && currentTime >= beat1End && currentTime < beat2End
  // Pathway Overlay (04s - 08s) on Main Invite
  const isPathwayBeat = isMainInvite && videoState === 'playing' && currentTime >= 4.0 && currentTime <= 8.0
  // Hedge Overlay (10.0s - 17.0s) on Main Invite: ARPIT'S 40TH & DIWALI CELEBRATION
  const isHedgeBeat = isMainInvite && videoState === 'playing' && currentTime >= 10.0 && currentTime <= 17.0
  // Band Music Overlay (31.0s - 32.5s) on Main Invite: WHERE MUSIC MEETS THE SOUL
  const isMusicBeat = isMainInvite && videoState === 'playing' && currentTime >= 31.0 && currentTime <= 32.5
  // Bar / Cocktail Lounge Overlay (35.0s - 37.0s) on Main Invite: WHERE THE SPIRITS SOAR
  const isSpiritsBeat = isMainInvite && videoState === 'playing' && currentTime >= 35.0 && currentTime <= 37.0
  // DJ Stage Overlay (40.0s - 42.0s) on Main Invite: WHEN THE NIGHT COMES ALIVE
  const isStageBeat = isMainInvite && videoState === 'playing' && currentTime >= 40.0 && currentTime <= 42.0
  // Beat 3 (RSVP Buttons): appears right after video ends (or if explicitly skipped, or immediately if video is unlinked)
  const isBeat3 = !hasVideo || showRsvpPrompt
  // Grand Finale Overlay (47.0s - 50.0s) on Main Invite: YOUR PRESENCE. THE PERFECT FINALE
  const isFinaleBeat = isMainInvite && !isBeat3 && videoState === 'playing' && currentTime >= 47.0 && currentTime <= 50.0

  // Personalized Save The Date reply status checks
  const isAttending = prevRsvpStatus === 'attending'
  const isDeclined = prevRsvpStatus === 'declined'
  const isPending = !isAttending && !isDeclined

  return (
    <div
      ref={containerRef}
      className={`relative w-full full-viewport-height bg-black overflow-hidden select-none ${
        soundPromptVisible ? 'cursor-pointer' : 'cursor-default'
      }`}
      onClick={soundPromptVisible ? handleUserInteraction : undefined}
    >
      {/* Ambient Luxury Backdrop for Main Invite 16:9 on Portrait Mobile */}
      {hasVideo && isMainInvite && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.18) 0%, rgba(139,26,40,0.14) 45%, #050D1A 85%)'
            }}
          />
          <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-3xl bg-amber-500/10 pointer-events-none" />
          <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-3xl bg-[#8B1A28]/15 pointer-events-none" />
        </div>
      )}

      {/* Video Element */}
      {hasVideo ? (
        <video
          ref={videoRef}
          src={targetUrl}
          className={`absolute inset-0 w-full h-full ${
            isMainInvite ? 'object-contain z-10' : 'object-cover'
          }`}
          playsInline
          webkit-playsinline="true"
          preload="auto"
          loop={false}
          muted={soundMuted}
          poster={EVENT.poster || undefined}
          onPlay={() => {
            if (endedCalledRef.current || showRsvpPrompt || videoState === 'ended') {
              videoRef.current?.pause()
            }
          }}
          onEnded={() => {
            if (endedCalledRef.current) return
            endedCalledRef.current = true
            videoRef.current?.pause()
            setVideoState('ended')
            if (endTimerRef.current) clearTimeout(endTimerRef.current)
            endTimerRef.current = setTimeout(() => {
              setShowRsvpPrompt(true)
            }, 800)
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

      {/* ── 5-SECOND LUXURY ROTATE PHONE SCREEN (BEFORE TAP TO ENTER - MAIN INVITE ONLY) ── */}
      {hasVideo && soundPromptVisible && rotatePromptActive && isMainInvite && (
        <div
          onClick={() => setRotatePromptActive(false)}
          className="absolute inset-0 z-[60] flex flex-col items-center justify-between p-6 sm:p-10 cursor-pointer select-none transition-all duration-700 animate-fadeIn"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(15,28,52,0.98) 0%, rgba(5,13,26,0.99) 70%, #050D1A 100%)'
          }}
        >
          {/* Top balance spacer */}
          <div className="w-full h-4 sm:h-8" />

          {/* Centerpiece: Animated 3D Gold Rotating Phone */}
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="relative w-44 h-44 flex items-center justify-center mb-5">
              {/* Glowing circular backdrop pulse */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C9A84C]/15 via-[#FFF0BD]/20 to-[#C9A84C]/10 blur-2xl animate-pulse-ring pointer-events-none" />

              {/* Orbiting circular dashed ring */}
              <svg className="absolute inset-0 w-full h-full text-[#C9A84C]/40 animate-spin" style={{ animationDuration: '10s' }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1.2" strokeDasharray="6 8" fill="none" />
              </svg>

              {/* The Rotating Gold Smartphone */}
              <div className="relative w-20 h-36 rounded-2xl border-2 border-[#C9A84C] bg-gradient-to-b from-[#13223A] to-[#08101D] shadow-[0_0_30px_rgba(201,168,76,0.4),inset_0_0_15px_rgba(201,168,76,0.2)] flex flex-col items-center justify-between p-2 animate-rotate-phone">
                {/* Speaker slit & Camera notch */}
                <div className="w-6 h-1 rounded-full bg-[#C9A84C]/70" />

                {/* Screen preview showing 16:9 landscape aspect ratio frame */}
                <div className="w-full flex-1 my-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#050D1A]/90 flex flex-col items-center justify-center p-1 relative overflow-hidden">
                  <div className="text-[16px]">🎬</div>
                  <span className="text-[9px] font-marcellus text-[#E8D5A3] tracking-widest mt-1 font-bold">16:9</span>
                </div>

                {/* Home Indicator line */}
                <div className="w-8 h-1 rounded-full bg-[#C9A84C]/70" />
              </div>
            </div>

            {/* Title: PLEASE ROTATE YOUR PHONE */}
            <h1
              className="font-marcellus text-2xl sm:text-4xl font-bold tracking-[0.12em] uppercase text-center mb-2 leading-tight px-4"
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF0BD 35%, #E2B755 75%, #9C6F16 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.95)) drop-shadow(0 -1px 0.8px rgba(255,247,208,0.5))',
              }}
            >
              PLEASE ROTATE YOUR PHONE
            </h1>

            {/* Subtitle */}
            <p className="font-marcellus text-xs sm:text-sm text-[#F5ECD7]/80 text-center tracking-wider max-w-xs px-2 leading-relaxed">
              Turn your device to landscape for the best widescreen experience
            </p>
          </div>

          {/* Bottom Countdown & Skip Button */}
          <div className="pb-4 sm:pb-8 flex flex-col items-center gap-3 w-full max-w-xs">
            {/* Countdown Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C9A84C]/40 bg-[#0A1931]/80 backdrop-blur-md">
              <span className="text-[#C9A84C] text-xs">⏳</span>
              <span className="font-sans text-[11px] tracking-[0.2em] uppercase text-[#F5ECD7] font-semibold">
                Opening in {rotateCountdown}s...
              </span>
            </div>

            {/* Tap to Skip */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setRotatePromptActive(false)
              }}
              className="text-[#C9A84C]/70 hover:text-[#C9A84C] text-[11px] font-marcellus tracking-[0.25em] uppercase underline underline-offset-4 transition-colors"
            >
              Continue ➔
            </button>
          </div>
        </div>
      )}

      {/* ── EMBOSSED GATE SCREEN (DESIGN 1: GOLD MARCELLUS) ── */}
      {hasVideo && soundPromptVisible && (
        <div
          onClick={handleUserInteraction}
          className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer p-4 transition-all duration-500 animate-fadeIn"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.88) 100%)'
          }}
        >
          <div className="flex flex-col items-center justify-center text-center max-w-xl w-full select-none px-4 max-h-screen py-2">
            {/* Tagline with Gold Diamonds */}
            <div className="flex items-center gap-2 mb-2 sm:mb-4">
              <span className="text-[#C9A84C] text-[9px] sm:text-[10px]">❖</span>
              <p
                className="font-marcellus text-[9px] sm:text-[11px] tracking-[0.45em] uppercase text-[#C9A84C] font-semibold"
                style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 -1px 0.5px rgba(255,249,210,0.5))' }}
              >
                A PERSONAL INVITATION
              </p>
              <span className="text-[#C9A84C] text-[9px] sm:text-[10px]">❖</span>
            </div>

            {/* Guest Name in Marcellus Title Case (Without "Hi") */}
            <h2
              className="font-marcellus text-2xl sm:text-4xl md:text-5xl font-bold tracking-wide mb-1 sm:mb-3 leading-tight px-2"
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
            <div className="relative w-40 sm:w-64 h-[3px] my-1 sm:my-3 flex items-center justify-center">
              <div className="absolute inset-0 bg-[#000000] translate-y-[1.5px] opacity-80 blur-[0.5px]" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent h-[1.6px]" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF5BD] to-transparent -translate-y-[1px] h-[0.8px] opacity-50" />
              <div className="relative z-10 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFF5BD] shadow-[0_0_6px_rgba(201,168,76,0.8)]" />
            </div>

            {/* BIG: THE NIGHT AWAITS or SAVE THE DATE (Monumental 3D Embossed Marcellus) */}
            <h1
              className="font-marcellus text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.14em] uppercase my-1 sm:my-2 leading-tight"
              style={{
                background: 'linear-gradient(180deg, #FFFDF5 0%, #FCE18F 25%, #D4A63B 60%, #7A540D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.98)) drop-shadow(0 -1.8px 1px rgba(255,255,255,0.7)) drop-shadow(0 0 16px rgba(212,166,59,0.45))',
              }}
            >
              {isSaveDate ? 'SAVE THE DATE' : 'THE NIGHT AWAITS'}
            </h1>

            {/* Event Subtitle */}
            <p
              className="font-marcellus text-[9px] sm:text-[11px] font-semibold tracking-[0.35em] uppercase text-[#E8D5A3] my-1.5 sm:my-3"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95))' }}
            >
              {isDiwaliEvent ? 'KHANDELWAL DIWALI CELEBRATION' : "ARPIT'S 40TH BIRTHDAY & DIWALI CELEBRATION"}
            </p>

            {/* Antique Brass Plaque Button: TAP TO ENTER */}
            <button
              type="button"
              onClick={handleUserInteraction}
              className="group relative mt-1.5 sm:mt-2 px-7 sm:px-9 py-2.5 sm:py-3.5 rounded-full border border-[#AA822E] bg-gradient-to-b from-[#1A1108] to-[#0D0804] text-[#FFF6D6] shadow-[0_4px_20px_rgba(0,0,0,0.9),0_0_20px_rgba(170,130,46,0.25)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.9),0_0_30px_rgba(170,130,46,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 pointer-events-auto"
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
              {/* Title: ONE NIGHT. TWO REASONS TO CELEBRATE */}
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
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
            </div>
          )}

          {/* ── CELEBRATION TITLE OVERLAY (10.0s - 17.0s): ARPIT'S 40TH & DIWALI CELEBRATION (SAME AS 2ND IMAGE ONLY) ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 pointer-events-none select-none px-6 text-center z-20 ${
                isHedgeBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">{isDiwaliEvent ? 'KHANDELWAL ' : "ARPIT'S 40TH "}</span>
                <span className="block sm:inline">&amp; DIWALI CELEBRATION</span>
              </h2>
            </div>
          )}

          {/* ── MORE MEANINGFUL BECAUSE OF YOU OVERLAY (19.0s - 22.0s): MOVES ALONG CAMERA & FADES ── */}
          {isMainInvite && (
            <div
              ref={festiveOverlayRef}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-6 text-center z-20 will-change-transform"
              style={{
                opacity: 0,
                transform: 'translate3d(0vw, 0%, 0) scale(0.90)',
              }}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">MORE MEANINGFUL </span>
                <span className="block sm:inline">BECAUSE OF YOU</span>
              </h2>
            </div>
          )}

          {/* ── LED STAGE SCREEN OVERLAY (25.2s - 29.5s): GUEST NAME + THE NIGHT ISN'T COMPLETE WITHOUT YOU ── */}
          {isMainInvite && (
            <div
              ref={stageOverlayRef}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 text-center z-20"
              style={{
                opacity: 0,
              }}
            >
              {/* Centered directly inside the glowing LED Stage Screen */}
              <div className="relative flex flex-col items-center justify-center px-2 py-1 max-w-[210px] sm:max-w-[380px]">
                {/* Personalized Guest Name glowing on the LED Screen */}
                <h2
                  className="font-marcellus text-sm sm:text-2xl md:text-3xl font-bold tracking-wide leading-tight px-1"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8E0 45%, #F5D06A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 8px rgba(255,238,180,0.95)) drop-shadow(0 0 20px rgba(240,196,90,0.65)) drop-shadow(0 1.5px 3px rgba(35,12,0,0.85))',
                  }}
                >
                  {formatGuestTitleCase(guestName)}
                </h2>

                {/* Delicate Gold Divider inside LED Screen */}
                <div className="flex items-center justify-center w-24 sm:w-48 my-1 opacity-90">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFE9A3] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white mx-1 shadow-[0_0_6px_#FFF]" />
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFE9A3] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                </div>

                {/* Below Guest Name inside LED Screen: THE NIGHT ISN'T COMPLETE WITHOUT YOU */}
                <p
                  className="font-marcellus text-[8px] sm:text-xs md:text-sm font-bold tracking-[0.16em] uppercase text-[#FFFDF5] leading-snug"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(245,210,120,0.85)) drop-shadow(0 1px 2px rgba(35,12,0,0.85))',
                  }}
                >
                  THE NIGHT ISN&apos;T COMPLETE
                  <span className="block text-[#FCE18F] mt-0.5 tracking-[0.20em]">WITHOUT YOU</span>
                </p>
              </div>
            </div>
          )}

          {/* ── WHERE MUSIC MEETS THE SOUL (31.0s - 32.5s): CENTERED LIKE ONE NIGHT. TWO REASONS TO CELEBRATE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isMusicBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">WHERE MUSIC </span>
                <span className="block sm:inline">MEETS THE SOUL</span>
              </h2>
            </div>
          )}

          {/* ── WHERE THE SPIRITS SOAR (35.0s - 37.0s): CENTERED LIKE ONE NIGHT. TWO REASONS TO CELEBRATE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isSpiritsBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">WHERE THE </span>
                <span className="block sm:inline">SPIRITS SOAR</span>
              </h2>
            </div>
          )}

          {/* ── WHEN THE NIGHT COMES ALIVE (40.0s - 42.0s): CENTERED LIKE ONE NIGHT. TWO REASONS TO CELEBRATE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isStageBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">WHEN THE NIGHT </span>
                <span className="block sm:inline">COMES ALIVE</span>
              </h2>
            </div>
          )}

          {/* ── GRAND FINALE OVERLAY (47.0s - 50.0s): YOUR PRESENCE. THE PERFECT FINALE ── */}
          {isMainInvite && !isBeat3 && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isFinaleBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <h2
                className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase max-w-4xl leading-tight px-4"
                style={{
                  background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.98)) drop-shadow(0 -1.5px 1px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.45))',
                }}
              >
                <span className="block sm:inline">YOUR PRESENCE. </span>
                <span className="block sm:inline">THE PERFECT FINALE</span>
              </h2>
            </div>
          )}

          {/* BEAT 3: Climax & Interactive CTAs */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 z-30 ${
            isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            {isSaveTheDate ? (
              /* ── SAVE THE DATE FLOW ── */
              <div className="flex flex-col items-center text-center px-4 max-w-sm mb-4">
                {isDiwali ? (
                  <>
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
                  </>
                ) : (
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
                    <span>📅</span> ADD TO CALENDAR
                  </button>
                </div>
              </div>
            ) : (
              /* ── MAIN INVITATION PERSONALIZED RSVP CLIMAX ── */
              <div className="relative w-full max-w-xl mx-auto flex flex-col items-center text-center px-3 sm:px-6 py-2 z-20 overflow-y-auto max-h-[92vh]">
                {/* Dynamic Status Micro-Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[#C9A84C]/50 bg-[#050D1A]/90 backdrop-blur-md mb-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  <span className="text-[10px] sm:text-xs tracking-[0.22em] uppercase font-semibold text-[#FCE18F]">
                    {isAttending
                      ? "✦ COUNTDOWN IS ON • CAN'T WAIT TO CELEBRATE ✦"
                      : isDeclined
                      ? "✦ A SPECIAL REQUEST • WE TRULY MISS YOU ✦"
                      : "✦ CORDIALLY INVITED • JOIN THE CELEBRATION ✦"}
                  </span>
                </div>

                {/* Personalized Guest Name */}
                <h2
                  className="font-marcellus text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.16em] uppercase leading-tight mb-2"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.95)) drop-shadow(0 0 14px rgba(212,175,55,0.45))',
                  }}
                >
                  {guestName ? `DEAR ${formatGuestTitleCase(guestName).toUpperCase()}` : 'DEAR HONORED GUEST'}
                </h2>

                {/* Dynamic Personalized Message based on Save The Date Reply */}
                {isAttending && !isDiwali ? (
                  <div className="font-serif text-xs sm:text-sm text-[#F5ECD7]/95 max-w-lg leading-relaxed mb-3 px-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] space-y-1.5">
                    <p className="italic">
                      You&rsquo;ve confirmed your presence, and We&rsquo;re delighted to have you join us! ✨
                    </p>
                    <p className="italic">
                      Get ready for <strong className="font-bold not-italic text-[#FCE18F]">40 &amp; FESTIVE</strong> — an unforgettable evening of Diwali sparkle, incredible music and magical moments as we celebrate Arpit&rsquo;s 40th Birthday.
                    </p>
                    <p className="font-sans text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#FCE18F] pt-0.5">
                      23 October 2026 · Jaipur
                    </p>
                    <p className="font-semibold text-[#FFFDF0]">
                      The night shines brighter with you! ❤️
                    </p>
                  </div>
                ) : (
                  <p className="font-serif italic text-xs sm:text-sm md:text-[15px] text-[#F5ECD7]/95 max-w-lg leading-relaxed mb-3.5 px-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                    {isAttending ? (
                      'You confirmed your presence, and our hearts are full! The Khandelwal family is eagerly waiting to celebrate the Festival of Lights with you.'
                    ) : isDeclined ? (
                      isDiwali
                        ? 'We know you had other commitments earlier, but our Diwali celebration truly won’t feel complete without you. We warmly request you to please reconsider and change your mind to celebrate with the Khandelwal family!'
                        : "We noticed you couldn't make it earlier, but this milestone celebration truly won't feel complete without you! We warmly request you to please reconsider and change your mind — it would mean the world to celebrate together!"
                    ) : (
                      isDiwali
                        ? 'The Khandelwal family cordially requests the honor of your gracious presence to celebrate our Grand Diwali Party. Please let us know if you will celebrate with us!'
                        : "We warmly request the honor of your gracious presence to celebrate Arpit's 40th milestone & Diwali festivities. Please let us know if you will be celebrating with us!"
                    )}
                  </p>
                )}

                {/* Royal Venue, Date & Time Glass Plaque - EXPANDED */}
                <div className="relative w-full max-w-lg px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl border border-[#C9A84C]/50 bg-gradient-to-b from-black/85 via-black/75 to-black/90 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col items-center mb-3">
                  {/* Date & Time Header */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[#FCE18F] font-marcellus text-xs sm:text-[13px] tracking-[0.16em] uppercase font-bold">
                    <span>🗓️ FRIDAY, OCT 23, 2026</span>
                    <span className="text-[#C9A84C]/60">•</span>
                    <span>⏰ 8:00 PM ONWARDS</span>
                  </div>

                  <div className="h-[1px] w-28 bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent my-2" />

                  {/* Venue Name */}
                  <h3
                    className="font-marcellus text-base sm:text-lg font-bold tracking-[0.16em] uppercase"
                    style={{
                      background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF2BD 40%, #E2BE5A 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
                    }}
                  >
                    &ldquo;THE FOOTHILLS VILLAS&rdquo;
                  </h3>

                  {/* Venue Address */}
                  <p className="text-[11px] sm:text-xs text-[#F5ECD7]/85 font-sans tracking-wide mt-0.5 leading-snug">
                    Near RAJASTHALI RESORT &amp; SPA, Kukas, Delhi Road, Jaipur
                  </p>

                  {/* Google Maps Link */}
                  <a
                    href={EVENT.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[11px] sm:text-xs font-sans font-medium text-[#FCE18F] hover:bg-[#C9A84C]/30 hover:text-white tracking-wider transition-all"
                  >
                    <span>📍</span> Open in Google Maps ➔
                  </a>
                </div>

                {/* Dynamic Action Buttons - EXPANDED */}
                <div className="flex flex-col gap-2.5 w-full max-w-lg items-center">
                  {isAttending ? (
                    <button
                      onClick={handleCalendar}
                      className="w-full max-w-xs py-3 px-6 glass border border-[#C9A84C]/60 hover:border-[#C9A84C] text-[#FCE18F] hover:text-white bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 font-sans font-semibold text-xs tracking-[0.16em] uppercase rounded-md shadow-lg shadow-[#C9A84C]/15 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <span>📅</span> ADD TO CALENDAR
                    </button>
                  ) : (
                    <>
                      {/* Primary RSVP Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectYes() }}
                        className="w-full py-3.5 px-6 bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white font-sans font-bold text-xs sm:text-sm tracking-[0.18em] uppercase rounded-md shadow-xl shadow-[#C9A84C]/30 hover:brightness-110 active:scale-95 transition-all"
                      >
                        {isDeclined
                          ? "🎉 CHANGE TO YES! I'LL BE THERE"
                          : "YES, I'LL BE THERE"}
                      </button>

                      {/* Secondary Buttons Row: Can't Make It + Add to Calendar */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectNo() }}
                          className="w-full py-2.5 px-3 glass border border-white/20 text-[#F5ECD7]/80 hover:text-white hover:border-white/40 font-sans font-medium text-[11px] sm:text-xs tracking-[0.14em] uppercase rounded-md active:scale-95 transition-all opacity-90 hover:opacity-100 flex items-center justify-center"
                        >
                          {isDeclined
                            ? "SORRY, STILL CAN'T MAKE IT"
                            : "SORRY, CAN'T MAKE IT"}
                        </button>

                        <button
                          onClick={handleCalendar}
                          className="w-full py-2.5 px-3 glass border border-[#C9A84C]/50 hover:border-[#C9A84C] text-[#C9A84C] hover:text-[#FCE18F] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 font-sans font-semibold text-[11px] sm:text-xs tracking-[0.14em] uppercase rounded-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>📅</span> ADD TO CALENDAR
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Sign-off */}
                <p className="font-serif italic text-xs sm:text-[13px] text-[#FCE18F]/80 mt-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {isDiwali ? 'Warmly, The Khandelwal Family' : 'Warmly, Tanvi'}
                </p>

                {/* ── DIGITAL COUNTDOWN CLOCK STRUCTURE DOWN THERE ── */}
                <div className="w-full max-w-sm sm:max-w-md mx-auto mt-3.5 mb-1 flex flex-col items-center select-none">
                  {/* Pulsing micro-badge */}
                  <div className="flex items-center gap-1.5 mb-1.5 px-3 py-0.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/35">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FCE18F] animate-ping" />
                    <span className="font-sans text-[9px] sm:text-[10px] tracking-[0.22em] uppercase font-semibold text-[#FCE18F]">
                      TIME LEFT FOR GRAND CELEBRATION
                    </span>
                  </div>

                  {/* Digital Clock Structure Container */}
                  <div className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl border border-[#C9A84C]/60 bg-gradient-to-b from-[#0A1324]/95 via-black/95 to-[#070D18]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)]">
                    {/* DAYS */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[62px]">
                      <div className="relative w-full py-1.5 px-1.5 rounded-md bg-gradient-to-b from-[#141C2B] to-[#0A0F1A] border border-[#C9A84C]/45 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden">
                        {/* Horizontal split-flap line */}
                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 pointer-events-none z-10" />
                        <span
                          className="font-mono text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider tabular-nums leading-none z-0"
                          style={{
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2BD 50%, #E2BE5A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 8px rgba(226,190,90,0.6))',
                          }}
                        >
                          {String(timeLeft.days).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="font-sans text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold text-[#C9A84C] mt-1">
                        DAYS
                      </span>
                    </div>

                    {/* Separator Colon */}
                    <span className="text-[#FCE18F] text-base sm:text-xl font-bold pb-3.5 animate-pulse">:</span>

                    {/* HOURS */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[62px]">
                      <div className="relative w-full py-1.5 px-1.5 rounded-md bg-gradient-to-b from-[#141C2B] to-[#0A0F1A] border border-[#C9A84C]/45 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 pointer-events-none z-10" />
                        <span
                          className="font-mono text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider tabular-nums leading-none z-0"
                          style={{
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2BD 50%, #E2BE5A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 8px rgba(226,190,90,0.6))',
                          }}
                        >
                          {String(timeLeft.hours).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="font-sans text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold text-[#C9A84C] mt-1">
                        HOURS
                      </span>
                    </div>

                    {/* Separator Colon */}
                    <span className="text-[#FCE18F] text-base sm:text-xl font-bold pb-3.5 animate-pulse">:</span>

                    {/* MINUTES */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[62px]">
                      <div className="relative w-full py-1.5 px-1.5 rounded-md bg-gradient-to-b from-[#141C2B] to-[#0A0F1A] border border-[#C9A84C]/45 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 pointer-events-none z-10" />
                        <span
                          className="font-mono text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider tabular-nums leading-none z-0"
                          style={{
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2BD 50%, #E2BE5A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 8px rgba(226,190,90,0.6))',
                          }}
                        >
                          {String(timeLeft.minutes).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="font-sans text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold text-[#C9A84C] mt-1">
                        MINS
                      </span>
                    </div>

                    {/* Separator Colon */}
                    <span className="text-[#FCE18F] text-base sm:text-xl font-bold pb-3.5 animate-pulse">:</span>

                    {/* SECONDS */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[62px]">
                      <div className="relative w-full py-1.5 px-1.5 rounded-md bg-gradient-to-b from-[#141C2B] to-[#0A0F1A] border border-[#C9A84C]/45 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 pointer-events-none z-10" />
                        <span
                          className="font-mono text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider tabular-nums leading-none z-0"
                          style={{
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2BD 50%, #E2BE5A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 8px rgba(226,190,90,0.6))',
                          }}
                        >
                          {String(timeLeft.seconds).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="font-sans text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold text-[#C9A84C] mt-1">
                        SECS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM NAVIGATION BAR */}
        {hasVideo && !isBeat3 && (
          <div className="w-full pb-4 flex justify-between items-center pointer-events-auto gap-2">
            <button
              onClick={toggleSound}
              className="glass px-3.5 py-2 rounded-full border border-[#C9A84C]/40 flex items-center gap-1.5 hover:bg-[#C9A84C]/10 transition-all active:scale-95 animate-pulse pointer-events-auto"
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
