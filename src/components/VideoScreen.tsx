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
  const hedgeOverlayRef = useRef<HTMLDivElement>(null)
  const stageOverlayRef = useRef<HTMLDivElement>(null)
  const soulOverlayRef = useRef<HTMLDivElement>(null)
  const [showRsvpPrompt, setShowRsvpPrompt] = useState(false)

  const targetUrl = customVideoUrl || EVENT.videoUrl || '/videos/main-invite.mp4'
  const isMainInvite = Boolean(!isSaveTheDate && inviteType !== 'save-the-date')
  const hasBurnedText = Boolean(isSaveTheDate || (customVideoUrl && (customVideoUrl.includes('save-the-date') || customVideoUrl.includes('save_date') || customVideoUrl.includes('diwali'))))

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
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
      const ics = buildICSContent()
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isDiwali ? 'diwali-party.ics' : 'arpit40.ics'
      a.click()
    } else {
      window.open(buildGoogleCalUrl(), '_blank')
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

    // Smooth 60fps camera-tracking loop for the 10s Hedge Overlay
    let rafId: number
    const updateHedgeTransform = () => {
      const el = hedgeOverlayRef.current
      if (el && video) {
        const t = video.currentTime
        if (t < 10.0 || t > 18.8 || video.paused) {
          if (t < 10.0 || t > 18.8) {
            el.style.opacity = '0'
          }
        } else {
          // 1. Opacity: fade in (10.0s -> 10.7s), hold (10.7s -> 17.7s), fade out as hedge exits left (17.7s -> 18.6s)
          let opacity = 1
          if (t < 10.7) {
            opacity = Math.max(0, Math.min(1, (t - 10.0) / 0.7))
          } else if (t > 17.7) {
            opacity = Math.max(0, Math.min(1, 1 - (t - 17.7) / 0.9))
          }

          // 2. 3D Perspective Scale: starts small inside the distant hedge (0.56 at 10s)
          // and grows naturally as the camera walks right up to the hedge (1.32 at 18s)
          const walkProgress = Math.max(0, Math.min(1, (t - 10.0) / 8.0))
          const scale = 0.56 + Math.pow(walkProgress, 1.25) * 0.76

          // 3. Vertical & Horizontal anchor on the hedge wall:
          // Gently shifts down slightly from +2% to +5.5% as camera approaches
          const translateY = 2.0 + walkProgress * 3.5

          // Stays centered on the hedge until 16.3s, drifts slightly left (16.3s -> 17.0s),
          // then pans left with the hedge as the camera turns right (17.0s -> 18.7s)
          let translateX = -0.5
          if (t > 16.3 && t <= 17.0) {
            const prePan = (t - 16.3) / 0.7
            translateX = -0.5 - prePan * 4.0
          } else if (t > 17.0) {
            const panProgress = Math.max(0, Math.min(1, (t - 17.0) / 1.7))
            const easedPan = panProgress * panProgress * (3 - 2 * panProgress)
            translateX = -4.5 - easedPan * 52
          }

          el.style.opacity = opacity.toFixed(3)
          el.style.transform = `translate3d(${translateX.toFixed(2)}vw, ${translateY.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`
        }
      }

      // 25.0s - 29.5s: Stick to the glowing LED Stage Screen, then fade up at 29s
      const stageEl = stageOverlayRef.current
      if (stageEl && video) {
        const t = video.currentTime
        if (t < 25.0 || t > 29.5 || video.paused) {
          if (t < 25.0 || t > 29.5) {
            stageEl.style.opacity = '0'
          }
        } else {
          // Fade in (25.0s -> 25.6s), hold locked on LED screen (25.6s -> 28.7s), fade up (28.7s -> 29.4s)
          let opacity = 1
          let fadeUpOffsetY = 0
          if (t < 25.6) {
            opacity = Math.max(0, Math.min(1, (t - 25.0) / 0.6))
          } else if (t > 28.7) {
            const fadeOutProgress = Math.max(0, Math.min(1, (t - 28.7) / 0.7))
            opacity = 1 - fadeOutProgress
            fadeUpOffsetY = -fadeOutProgress * 2.8 // Smoothly fades UP at 29s
          }

          // Subtle camera push-in on the LED screen between 25.0s and 29.4s
          const stageProgress = Math.max(0, Math.min(1, (t - 25.0) / 4.4))
          const scale = 0.94 + stageProgress * 0.11
          const translateX = 3.8
          const translateY = 0.4 + fadeUpOffsetY

          stageEl.style.opacity = opacity.toFixed(3)
          stageEl.style.transform = `translate3d(${translateX.toFixed(2)}vw, ${translateY.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`
        }
      }

      // 31.0s - 32.5s: WHERE MUSIC MEETS THE SOUL in the upper portion of the LED screen above the band
      const soulEl = soulOverlayRef.current
      if (soulEl && video) {
        const t = video.currentTime
        if (t < 31.0 || t > 32.6 || video.paused) {
          if (t < 31.0 || t > 32.6) {
            soulEl.style.opacity = '0'
          }
        } else {
          // Fade in (31.0s -> 31.3s), hold (31.3s -> 32.1s), fade out (32.1s -> 32.5s)
          let opacity = 1
          let fadeUpY = 0
          if (t < 31.3) {
            opacity = Math.max(0, Math.min(1, (t - 31.0) / 0.3))
          } else if (t > 32.1) {
            const outProg = Math.max(0, Math.min(1, (t - 32.1) / 0.45))
            opacity = 1 - outProg
            fadeUpY = -outProg * 2.0
          }

          const soulProg = Math.max(0, Math.min(1, (t - 31.0) / 1.5))
          const scale = 1.0 + soulProg * 0.04
          const translateX = 5.4
          const translateY = -10.2 + fadeUpY

          soulEl.style.opacity = opacity.toFixed(3)
          soulEl.style.transform = `translate3d(${translateX.toFixed(2)}vw, ${translateY.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`
        }
      }

      rafId = requestAnimationFrame(updateHedgeTransform)
    }
    rafId = requestAnimationFrame(updateHedgeTransform)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      cancelAnimationFrame(rafId)
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
  const handleUserInteraction = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHasTappedSound(true)
    setSoundPromptVisible(false)

    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current)
      autoPlayTimerRef.current = null
    }

    const video = videoRef.current

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
        }).catch((err) => {
          console.warn('Unmuted play blocked by browser, trying muted:', err)
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
  // Beat 3 (RSVP Buttons): only appears 2.5 seconds AFTER video ends (or if explicitly skipped)
  const isBeat3 = showRsvpPrompt

  return (
    <div
      className="relative w-full full-viewport-height bg-black overflow-hidden select-none cursor-pointer"
      onClick={handleUserInteraction}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={targetUrl}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        preload="auto"
        muted
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

      {/* Dark Vignette Overlay for Crisp Typography Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/80 pointer-events-none" />

      {/* Dimming overlay when RSVP buttons appear (2.5s after video ends) */}
      <div
        className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-1000 pointer-events-none z-10 ${
          isBeat3 ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── EMBOSSED GATE SCREEN (DESIGN 1: ROYAL MARCELLUS) OR FALLBACK TAP FOR SOUND ── */}
      {soundPromptVisible && (
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
                ARPIT&apos;S 40TH BIRTHDAY &amp; DIWALI CELEBRATION
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

          {/* ── HEDGE SCENE-TRACKED OVERLAY (10.0s - 18.8s): PHYSICALLY MOUNTED ON THE HEDGE ── */}
          {isMainInvite && (
            <div
              ref={hedgeOverlayRef}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 text-center z-20 will-change-transform"
              style={{
                opacity: 0,
                transform: 'translate3d(-0.5vw, 2%, 0) scale(0.56)',
              }}
            >
              <div className="relative flex flex-col items-center justify-center py-2 px-5">
                {/* Warm golden fairy-light glow cast onto the hedge foliage behind the sign */}
                <div
                  className="absolute inset-0 -z-10 rounded-full blur-xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(245,166,35,0.32) 0%, rgba(201,130,18,0.14) 60%, rgba(0,0,0,0) 100%)',
                  }}
                />

                {/* Line 1: 40 & Festive (Warm Glowing Gold Neon/Brass Script sitting on the upper hedge) */}
                <h2
                  className="font-script text-3xl sm:text-5xl tracking-normal leading-none px-2"
                  style={{
                    background: 'linear-gradient(180deg, #FFFDF5 0%, #FFEBA8 35%, #E5B546 75%, #A87414 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 6px rgba(255,191,71,0.75)) drop-shadow(0 0 14px rgba(212,139,23,0.45))',
                  }}
                >
                  40 &amp; Festive
                </h2>

                {/* Thin Brass Bar Divider */}
                <div className="flex items-center justify-center w-28 sm:w-36 my-1.5 opacity-90">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFE999] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.95)]" />
                  <span className="w-1 h-1 rounded-full bg-[#FFFDF0] mx-1.5 shadow-[0_0_6px_rgba(255,191,71,0.9)]" />
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFE999] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.95)]" />
                </div>

                {/* Line 2: ARPIT'S 40TH */}
                <p
                  className="font-marcellus text-[10px] sm:text-xs font-bold tracking-[0.24em] uppercase leading-tight"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2C2 45%, #DDA938 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 6px rgba(255,191,71,0.6))',
                  }}
                >
                  ARPIT&apos;S 40TH
                </p>

                {/* Line 3: & DIWALI CELEBRATION */}
                <p
                  className="font-marcellus text-[8.5px] sm:text-[10px] font-bold tracking-[0.2em] uppercase leading-tight mt-0.5"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF2C2 45%, #DDA938 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 6px rgba(255,191,71,0.6))',
                  }}
                >
                  &amp; DIWALI CELEBRATION
                </p>
              </div>
            </div>
          )}

          {/* ── LED STAGE SCREEN OVERLAY (25.0s - 29.4s): GUEST NAME + THE NIGHT ISN'T COMPLETE WITHOUT YOU ── */}
          {isMainInvite && (
            <div
              ref={stageOverlayRef}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 text-center z-20 will-change-transform"
              style={{
                opacity: 0,
                transform: 'translate3d(3.8vw, 0.4%, 0) scale(0.94)',
              }}
            >
              {/* Fitted strictly inside the glowing LED Stage Screen */}
              <div
                className="relative flex flex-col items-center justify-center px-3 py-2.5 rounded-[2px] max-w-[165px] sm:max-w-[200px]"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(30,14,2,0.62) 0%, rgba(30,14,2,0.42) 70%, rgba(0,0,0,0.12) 100%)',
                }}
              >
                {/* Personalized Guest Name on the LED Screen */}
                <h2
                  className="font-marcellus text-sm sm:text-xl font-bold tracking-wide leading-tight px-1"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF6D6 45%, #F0C45A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 2px rgba(26,10,0,0.95)) drop-shadow(0 0 4px rgba(0,0,0,0.75))',
                  }}
                >
                  {formatGuestTitleCase(guestName)}
                </h2>

                {/* Delicate Gold Divider inside LED Screen */}
                <div className="flex items-center justify-center w-20 sm:w-28 my-1.5 opacity-85">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFF2BD] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                  <span className="w-1 h-1 rounded-full bg-white mx-1.5" />
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FFF2BD] to-transparent shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                </div>

                {/* Below Guest Name inside LED Screen: THE NIGHT ISN'T COMPLETE WITHOUT YOU */}
                <p
                  className="font-marcellus text-[7.5px] sm:text-[9.5px] font-bold tracking-[0.18em] uppercase text-[#FFFDF0] leading-snug"
                  style={{
                    filter: 'drop-shadow(0 1.5px 2px rgba(26,10,0,0.95)) drop-shadow(0 0 3px rgba(0,0,0,0.8))',
                  }}
                >
                  THE NIGHT ISN&apos;T COMPLETE
                  <span className="block text-[#FCE18F] mt-0.5 tracking-[0.22em]">WITHOUT YOU</span>
                </p>
              </div>
            </div>
          )}

          {/* ── UPPER LED SCREEN OVERLAY ABOVE BAND (31.0s - 32.5s): WHERE MUSIC MEETS THE SOUL ── */}
          {isMainInvite && (
            <div
              ref={soulOverlayRef}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 text-center z-20 will-change-transform"
              style={{
                opacity: 0,
                transform: 'translate3d(5.4vw, -10.2%, 0) scale(1.0)',
              }}
            >
              <div
                className="relative flex flex-col items-center justify-center px-3 py-1.5 rounded-[2px] max-w-[175px] sm:max-w-[215px]"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(30,14,2,0.58) 0%, rgba(30,14,2,0.36) 75%, rgba(0,0,0,0) 100%)',
                }}
              >
                <p
                  className="font-marcellus text-[10px] sm:text-[13px] font-bold tracking-[0.22em] uppercase leading-snug"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF6D6 45%, #F0C45A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 2px rgba(26,10,0,0.95)) drop-shadow(0 0 4px rgba(0,0,0,0.75))',
                  }}
                >
                  WHERE MUSIC
                  <span className="block text-[#FCE18F] mt-0.5 tracking-[0.22em]">MEETS THE SOUL</span>
                </p>
              </div>
            </div>
          )}

          {/* BEAT 3: Climax & Interactive CTAs */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            {(!hasBurnedText || isDiwali) && (
              <>
                <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/90 mb-2">
                  {isDiwali ? 'DRINKS  ·  DANCE  ·  CELEBRATION' : 'DIWALI VIBES • FAB 40 • MEMORIES'}
                </p>
                <h3 className="font-serif text-2xl sm:text-4xl text-[#F5ECD7] font-bold mb-2">
                  FRIDAY | OCT 23, 2026
                </h3>
                <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/60 mb-6">
                  {isDiwali ? 'JAIPUR' : 'JAIPUR · RAJASTHAN'}
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
                <span>📅</span> {isDiwali ? 'ADD TO CALENDAR (iOS / ANDROID)' : 'ADD TO CALENDAR'}
              </button>
            </div>
          </div>

        </div>

        {/* BOTTOM NAVIGATION BAR */}
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
      </div>

    </div>
  )
}
