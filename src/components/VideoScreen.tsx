'use client'
// Build: v2.4 - Single date display on luxury plaque (no duplicate date text)

import { useEffect, useRef, useState } from 'react'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'
import { trackEvent } from '@/lib/supabase'
import {
  isCurrentlyFullscreen,
  isFullscreenSupported,
  enterFullscreen,
  exitFullscreen,
  toggleFullscreen,
  collapseAddressBar
} from '@/lib/fullscreen'

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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canFullscreen, setCanFullscreen] = useState(false)
  const startedRef = useRef(false)
  const endedCalledRef = useRef(false)
  const endTimerRef = useRef<NodeJS.Timeout | null>(null)
  const greetingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showRsvpPrompt, setShowRsvpPrompt] = useState(false)
  const [showPersonalGreeting, setShowPersonalGreeting] = useState(true)
  const hasAutoSwitchedRef = useRef(false)
  const onStartRef = useRef(onStart)
  const containerRef = useRef<HTMLDivElement>(null)
  const festiveOverlayRef = useRef<HTMLDivElement>(null)
  const stageOverlayRef = useRef<HTMLDivElement>(null)

  // Sync Fullscreen state from DOM and check browser support
  useEffect(() => {
    setCanFullscreen(isFullscreenSupported())
    const updateFsState = () => {
      setIsFullscreen(isCurrentlyFullscreen())
    }
    document.addEventListener('fullscreenchange', updateFsState)
    document.addEventListener('webkitfullscreenchange', updateFsState)
    document.addEventListener('mozfullscreenchange', updateFsState)
    document.addEventListener('MSFullscreenChange', updateFsState)
    document.addEventListener('customfullscreenchange', updateFsState)
    return () => {
      document.removeEventListener('fullscreenchange', updateFsState)
      document.removeEventListener('webkitfullscreenchange', updateFsState)
      document.removeEventListener('mozfullscreenchange', updateFsState)
      document.removeEventListener('MSFullscreenChange', updateFsState)
      document.removeEventListener('customfullscreenchange', updateFsState)
    }
  }, [])

  // Auto Fullscreen on landscape rotation
  useEffect(() => {
    if (typeof window === 'undefined') return

    let prevOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'

    const handleOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight
      const currentOrientation = isLandscape ? 'landscape' : 'portrait'
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (prevOrientation !== currentOrientation) {
        if (isLandscape && isMobile) {
          collapseAddressBar()
        } else if (!isLandscape && isMobile) {
          exitFullscreen()
        }
      }

      prevOrientation = currentOrientation
    }

    if (window.innerWidth > window.innerHeight) {
      collapseAddressBar()
    }

    window.addEventListener('resize', handleOrientation)
    window.addEventListener('orientationchange', handleOrientation)
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientation)
    }

    return () => {
      window.removeEventListener('resize', handleOrientation)
      window.removeEventListener('orientationchange', handleOrientation)
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientation)
      }
    }
  }, [])

  useEffect(() => {
    onStartRef.current = onStart
  }, [onStart])


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
      // If mobile device is physically rotated to landscape, dismiss immediately and enter fullscreen
      if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) {
        setRotatePromptActive(false)
        enterFullscreen(containerRef.current)
        collapseAddressBar()
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
    setShowPersonalGreeting(true)
    setShowRsvpPrompt(true)
  }

  useEffect(() => {
    if (!active) {
      setShowRsvpPrompt(false)
      setShowPersonalGreeting(true)
      startedRef.current = false
      endedCalledRef.current = false
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current)
      const video = videoRef.current
      if (video) video.pause()
      return
    }

    if (!hasVideo) {
      setVideoState('ended')
      setShowPersonalGreeting(true)
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

      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      if (isMainInvite) {
        // Main Invite: Immediately show the 5-second Personal Greeting screen, which then transitions to the Final One-Screen Venue & RSVP card
        setShowPersonalGreeting(true)
        setShowRsvpPrompt(true)
      } else {
        // Save the Date: Wait 2.5 seconds after video ends before presenting RSVP buttons
        endTimerRef.current = setTimeout(() => {
          setShowRsvpPrompt(true)
        }, 2500)
      }
    }

    const handleError = (e: Event) => {
      console.warn('Video load error:', e)
      setVideoState('unavailable')
      setShowPersonalGreeting(true)
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

  // Auto-switch: Show Stage 1 (Personal Greeting + RSVP & Add to Calendar) for 4 seconds, then automatically transition to Stage 2 (Venue + Sign-off)
  useEffect(() => {
    if (!showRsvpPrompt || !isMainInvite || hasAutoSwitchedRef.current) return
    if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current)
    greetingTimerRef.current = setTimeout(() => {
      hasAutoSwitchedRef.current = true
      setShowPersonalGreeting(false)
    }, 4000)
    return () => {
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current)
    }
  }, [showRsvpPrompt, isMainInvite])

  const handleUserInteraction = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation()
    }
    // Never restart or play video once it has reached the RSVP end screen
    if (endedCalledRef.current || videoState === 'ended' || showRsvpPrompt) {
      return
    }

    const video = videoRef.current
    // If video is already playing but was muted, unmute immediately on tap
    if (!soundPromptVisible) {
      if (video && video.muted) {
        video.muted = false
        video.volume = 1.0
        setSoundMuted(false)
      }
      return
    }

    setHasTappedSound(true)
    setSoundPromptVisible(false)
    setSoundMuted(false)

    if (video) {
      // Direct user gesture: unmute and set full volume before calling play()
      video.muted = false
      video.defaultMuted = false
      video.volume = 1.0

      const playPromise = video.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            video.muted = false
            video.volume = 1.0
            setSoundMuted(false)
            setVideoState('playing')
            if (!startedRef.current) {
              startedRef.current = true
              onStartRef.current()
            }
            // Safely collapse address bar after video & audio playback have begun smoothly
            setTimeout(() => {
              if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) {
                enterFullscreen(containerRef.current)
              }
              collapseAddressBar()
            }, 300)
          })
          .catch((err: unknown) => {
            const error = err as { name?: string; message?: string }
            console.warn('Playback error or interruption:', error)
            // If interrupted (e.g. AbortError due to fast tap or orientation transition), RETRY UNMUTED!
            if (error?.name === 'AbortError') {
              setTimeout(() => {
                if (video && video.paused) {
                  video.muted = false
                  video.volume = 1.0
                  video.play()
                    .then(() => {
                      setSoundMuted(false)
                      setVideoState('playing')
                      if (!startedRef.current) {
                        startedRef.current = true
                        onStartRef.current()
                      }
                    })
                    .catch((err2) => {
                      console.warn('Retry result:', err2)
                      if ((err2 as { name?: string })?.name === 'NotAllowedError') {
                        video.muted = true
                        setSoundMuted(true)
                        video.play().catch(() => {})
                      }
                    })
                }
              }, 100)
            } else if (error?.name === 'NotAllowedError') {
              // Only fallback to muted if browser explicitly disallowed unmuted autoplay
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
                .catch(() => {})
            }
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
    if (!nextMuted) {
      video.volume = 1.0
    }
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

  // Click handler on main container: when video is playing in landscape and not yet fullscreen,
  // any tap on the screen immediately enters fullscreen and collapses address bar.
  const handleContainerClick = (e: React.MouseEvent) => {
    if (soundPromptVisible || (videoState === 'playing' && soundMuted)) {
      handleUserInteraction(e)
      return
    }

    if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight && !isFullscreen) {
      enterFullscreen(containerRef.current)
      collapseAddressBar()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full full-viewport-height bg-black overflow-y-auto overflow-x-hidden touch-pan-y select-none ${
        soundPromptVisible || soundMuted || (!isFullscreen && typeof window !== 'undefined' && window.innerWidth > window.innerHeight)
          ? 'cursor-pointer'
          : 'cursor-default'
      }`}
      style={{ WebkitOverflowScrolling: 'touch' }}
      onClick={handleContainerClick}
    >
      {/* ── FLOATING TOP CONTROLS BAR: FULLSCREEN (MAIN INVITE ONLY) & SKIP ── */}
      <div className="fixed top-3 inset-x-3 sm:top-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-[70]">
        {/* Luxury Fullscreen Toggle Pill (Main Invite only) */}
        {isMainInvite && canFullscreen ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleFullscreen(containerRef.current)
            }}
            className={`pointer-events-auto glass px-3 py-1.5 rounded-full border border-[#C9A84C]/50 bg-[#050D1A]/85 text-[#F5ECD7] hover:text-white hover:border-[#C9A84C] hover:bg-[#C9A84C]/25 transition-all active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.85)] flex items-center gap-1.5 backdrop-blur-md cursor-pointer ${
              !isFullscreen && typeof window !== 'undefined' && window.innerWidth > window.innerHeight
                ? 'ring-2 ring-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.6)] animate-pulse'
                : ''
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <span className="text-[#C9A84C] text-xs font-bold leading-none">
              {isFullscreen ? '✕' : '⛶'}
            </span>
            <span className="font-sans text-[10px] tracking-[0.18em] uppercase font-semibold text-[#E8D5A3]">
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </span>
          </button>
        ) : <div />}

        {/* Skip Button: 'RSVP/VENUE' on Main Invite, original 'Skip to RSVP ⏭' on Save The Date */}
        {videoState === 'playing' && showSkip && !isBeat3 ? (
          <button
            type="button"
            onClick={handleSkip}
            className="pointer-events-auto glass px-3.5 py-1.5 rounded-full border border-[#C9A84C]/50 bg-[#050D1A]/85 text-[10px] font-sans font-semibold tracking-[0.2em] uppercase text-[#F5ECD7]/90 hover:text-white hover:border-[#C9A84C] hover:bg-[#C9A84C]/25 transition-all active:scale-95 flex items-center gap-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.85)] backdrop-blur-md cursor-pointer"
          >
            {isMainInvite ? (
              <span>RSVP/VENUE</span>
            ) : (
              <>
                <span>Skip to RSVP</span>
                <span className="text-xs">⏭</span>
              </>
            )}
          </button>
        ) : <div />}
      </div>

      {/* ── FLOATING LANDSCAPE FULLSCREEN PROMPT (MAIN INVITE ONLY) ── */}
      {isMainInvite && hasVideo && !soundPromptVisible && !isFullscreen && canFullscreen && videoState === 'playing' && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            enterFullscreen(containerRef.current)
            collapseAddressBar()
          }}
          className="hidden landscape:flex fixed top-3 left-1/2 -translate-x-1/2 z-[75] items-center gap-2 px-4 py-1.5 rounded-full bg-black/85 border border-[#C9A84C]/80 text-[#E8D5A3] shadow-[0_4px_20px_rgba(0,0,0,0.9)] backdrop-blur-md cursor-pointer animate-pulse transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span className="text-[#C9A84C] text-xs font-bold">⛶</span>
          <span className="font-marcellus text-[11px] tracking-[0.2em] uppercase text-white font-medium">
            Tap anywhere for Fullscreen
          </span>
        </div>
      )}

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
          className={`absolute inset-0 w-full h-full transition-all duration-300 ${
            isMainInvite ? 'object-contain z-10' : 'object-cover'
          }`}
          playsInline
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

      {/* Dimming overlay when RSVP buttons appear */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-700 pointer-events-none z-[15] ${
          isBeat3 ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── 5-SECOND LUXURY ROTATE PHONE SCREEN (BEFORE TAP TO ENTER - MAIN INVITE ONLY) ── */}
      {hasVideo && soundPromptVisible && rotatePromptActive && isMainInvite && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setRotatePromptActive(false)
            enterFullscreen(containerRef.current)
            collapseAddressBar()
          }}
          className="absolute inset-0 z-[60] overflow-y-auto overflow-x-hidden touch-pan-y flex flex-col items-center justify-between p-6 sm:p-10 cursor-pointer select-none transition-all duration-700 animate-fadeIn"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(15,28,52,0.98) 0%, rgba(5,13,26,0.99) 70%, #050D1A 100%)',
            WebkitOverflowScrolling: 'touch',
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
                enterFullscreen(containerRef.current)
                collapseAddressBar()
              }}
              className="text-[#C9A84C]/70 hover:text-[#C9A84C] text-[11px] font-marcellus tracking-[0.25em] uppercase underline underline-offset-4 transition-colors cursor-pointer"
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
          className="absolute inset-0 z-50 overflow-y-auto overflow-x-hidden touch-pan-y flex flex-col items-center justify-start cursor-pointer p-4 transition-all duration-500 animate-fadeIn"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.88) 100%)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="flex flex-col items-center justify-center text-center max-w-xl w-full select-none px-4 my-auto py-4">
            {/* Tagline with Gold Diamonds */}
            <div className="flex items-center gap-2 mb-2 sm:mb-4">
              <span className="text-[#C9A84C] text-[9px] sm:text-[10px]">❖</span>
              <p
                className="font-marcellus text-[9px] sm:text-[11px] tracking-[0.45em] uppercase text-[#C9A84C] font-semibold"
                style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 -1px 0.5px rgba(255,249,210,0.5))' }}
              >
                {isDiwaliEvent ? 'A FESTIVE INVITATION' : 'A PERSONAL INVITATION'}
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

            {/* Carved Gold Inlay Divider with Center "TAP" Pill */}
            <div className="relative w-56 sm:w-80 my-2 sm:my-3 flex items-center justify-center pointer-events-auto">
              {/* Left gold hairline */}
              <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9A84C] to-[#FFF5BD]" />

              {/* Glowing TAP Pill */}
              <button
                type="button"
                onClick={handleUserInteraction}
                className="group relative mx-2.5 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full border border-[#C9A84C]/90 bg-gradient-to-b from-[#1A1108] via-[#0E0A05] to-[#050302] text-[#FFF6D6] shadow-[0_0_15px_rgba(201,168,76,0.45),inset_0_1px_0_rgba(255,245,189,0.35)] hover:shadow-[0_0_25px_rgba(201,168,76,0.7)] hover:border-[#FFF5BD] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer animate-pulse"
              >
                <span className="font-marcellus text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-1.5 text-gold">
                  <span className="text-[8px] text-[#C9A84C]">✦</span>
                  <span>TAP</span>
                  <span className="text-[8px] text-[#C9A84C]">✦</span>
                </span>
              </button>

              {/* Right gold hairline */}
              <div className="flex-1 h-[1.5px] bg-gradient-to-l from-transparent via-[#C9A84C] to-[#FFF5BD]" />
            </div>

            {/* BIG: THE FESTIVAL OF LIGHTS AWAITS or THE NIGHT AWAITS or SAVE THE DATE (Monumental 3D Embossed Marcellus) */}
            <h1
              className="font-marcellus text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.14em] uppercase my-1 sm:my-2 leading-tight"
              style={{
                background: 'linear-gradient(180deg, #FFFDF5 0%, #FCE18F 25%, #D4A63B 60%, #7A540D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.98)) drop-shadow(0 -1.8px 1px rgba(255,255,255,0.7)) drop-shadow(0 0 16px rgba(212,166,59,0.45))',
              }}
            >
              {isSaveDate
                ? 'SAVE THE DATE'
                : isDiwaliEvent
                ? 'THE FESTIVAL OF LIGHTS AWAITS'
                : 'THE NIGHT AWAITS'}
            </h1>

            {/* Event Subtitle */}
            <p
              className="font-marcellus text-[9px] sm:text-[11px] font-semibold tracking-[0.35em] uppercase text-[#E8D5A3] my-1.5 sm:my-3"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95))' }}
            >
              {isDiwaliEvent ? 'KHANDELWAL DIWALI CELEBRATION' : "ARPIT'S 40TH BIRTHDAY & DIWALI CELEBRATION"}
            </p>
          </div>
        </div>
      )}

      {/* ── MOVIE TEASER DYNAMIC TEXT OVERLAY SEQUENCE ── */}
      <div className={`absolute inset-0 flex flex-col justify-between pointer-events-none z-20 ${
        isBeat3 ? 'p-2 sm:px-6 sm:py-2' : 'p-6 sm:p-10'
      }`}>

        {/* Top Header spacer (only when video is playing, never on Beat 3 end screen) */}
        {!isBeat3 && <div className="w-full pt-4 px-2 min-h-[44px]" />}

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

          {/* ── PATHWAY OVERLAY (04s - 08s): THE FESTIVAL OF LIGHTS AWAITS / ONE NIGHT. TWO REASONS TO CELEBRATE ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 pointer-events-none select-none px-6 text-center z-20 ${
                isPathwayBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  {isDiwaliEvent ? (
                    <span>THE FESTIVAL OF LIGHTS AWAITS</span>
                  ) : (
                    <>
                      <span className="block sm:inline">ONE NIGHT. </span>
                      <span className="block sm:inline">TWO REASONS TO CELEBRATE</span>
                    </>
                  )}
                </h2>
              </div>
            </div>
          )}

          {/* ── CELEBRATION TITLE OVERLAY (10.0s - 17.0s): KHANDELWAL DIWALI CELEBRATION / ARPIT'S 40TH & DIWALI CELEBRATION ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 pointer-events-none select-none px-6 text-center z-20 ${
                isHedgeBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  {isDiwaliEvent ? (
                    <span>KHANDELWAL DIWALI CELEBRATION</span>
                  ) : (
                    <>
                      <span className="block sm:inline">ARPIT&apos;S 40TH </span>
                      <span className="block sm:inline">&amp; DIWALI CELEBRATION</span>
                    </>
                  )}
                </h2>
              </div>
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
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  <span className="block sm:inline">MORE MEANINGFUL </span>
                  <span className="block sm:inline">BECAUSE OF YOU</span>
                </h2>
              </div>
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
              {/* Centered directly inside the glowing LED Stage Screen with dark contrast pillow */}
              <div className="relative flex flex-col items-center justify-center px-3 py-1.5 max-w-[220px] sm:max-w-[390px]">
                {/* Stage LED Contrast Pillow */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.2) 100%)',
                    filter: 'blur(8px)',
                  }}
                />
                {/* Personalized Guest Name glowing on the LED Screen with Chiseled Outline */}
                <h2
                  className="font-marcellus text-sm sm:text-2xl md:text-3xl font-bold tracking-wide leading-tight px-1"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8E0 45%, #F5D06A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.35px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(240,196,90,0.5))',
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
                  className="font-marcellus text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.16em] uppercase text-[#FFFDF5] leading-snug"
                  style={{
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 1.5px 3px rgba(0,0,0,0.95))',
                  }}
                >
                  THE NIGHT ISN&apos;T COMPLETE
                  <span className="block text-[#FCE18F] mt-0.5 tracking-[0.20em]">WITHOUT YOU</span>
                </p>
              </div>
            </div>
          )}

          {/* ── WHERE MUSIC MEETS THE SOUL (31.0s - 32.5s): CENTERED ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isMusicBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  <span className="block sm:inline">WHERE MUSIC </span>
                  <span className="block sm:inline">MEETS THE SOUL</span>
                </h2>
              </div>
            </div>
          )}

          {/* ── WHERE THE SPIRITS SOAR (35.0s - 37.0s): CENTERED ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isSpiritsBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  <span className="block sm:inline">WHERE THE </span>
                  <span className="block sm:inline">SPIRITS SOAR</span>
                </h2>
              </div>
            </div>
          )}

          {/* ── WHEN THE NIGHT COMES ALIVE (40.0s - 42.0s): CENTERED ── */}
          {isMainInvite && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isStageBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  <span className="block sm:inline">WHEN THE NIGHT </span>
                  <span className="block sm:inline">COMES ALIVE</span>
                </h2>
              </div>
            </div>
          )}

          {/* ── GRAND FINALE OVERLAY (47.0s - 50.0s): YOUR PRESENCE. THE PERFECT FINALE ── */}
          {isMainInvite && !isBeat3 && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 pointer-events-none select-none px-6 text-center z-20 ${
                isFinaleBeat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
              }`}
            >
              <div className="relative inline-flex flex-col items-center justify-center max-w-4xl px-4 text-center">
                {/* Soft Ambient Contrast Pillow */}
                <div
                  className="absolute -inset-x-8 sm:-inset-x-16 -inset-y-4 sm:-inset-y-8 rounded-full pointer-events-none -z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0) 78%)',
                    filter: 'blur(16px)',
                  }}
                />
                <h2
                  className="font-marcellus text-xl sm:text-4xl md:text-5xl font-bold tracking-[0.16em] uppercase leading-tight px-4"
                  style={{
                    background: 'linear-gradient(135deg, #FFFDF0 0%, #F5DE9C 30%, #D4AF37 70%, #9C731A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '0.4px rgba(0,0,0,0.85)',
                    filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.98)) drop-shadow(0 4px 14px rgba(0,0,0,0.92))',
                  }}
                >
                  <span className="block sm:inline">YOUR PRESENCE. </span>
                  <span className="block sm:inline">THE PERFECT FINALE</span>
                </h2>
              </div>
            </div>
          )}

          {/* BEAT 3: Climax & Interactive CTAs (Scrollable in portrait & landscape) */}
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain transition-all duration-700 z-30 ${
              isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
            }`}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="min-h-full w-full flex flex-col items-center justify-start py-3 sm:py-5 px-2">
              {isSaveDate ? (
                /* ── SAVE THE DATE FLOW ── */
                <div className="flex flex-col items-center text-center px-4 max-w-sm my-auto py-2">
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
                /* ── MAIN INVITATION TWO-STAGE CLIMAX WITH TOP VENUE TAB (SCROLLABLE) ── */
                <div className="relative w-full max-w-4xl mx-auto my-auto flex flex-col items-center justify-start text-center px-2 sm:px-5 py-2 z-20">

                  {/* ── TOP TAB BAR: SWITCH BETWEEN RSVP & VENUE ── */}
                  <div className="inline-flex items-center p-0.5 sm:p-1 rounded-full border-2 border-[#C9A84C]/85 bg-[#050D1A]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.95),0_0_14px_rgba(201,168,76,0.25)] mb-2 sm:mb-2.5 landscape:mb-1.5 z-30 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      hasAutoSwitchedRef.current = true
                      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current)
                      setShowPersonalGreeting(true)
                    }}
                    className={`px-4 sm:px-5 py-1 landscape:py-0.5 rounded-full font-sans text-[10px] sm:text-xs tracking-[0.18em] uppercase font-bold transition-all cursor-pointer ${
                      showPersonalGreeting
                        ? 'bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white shadow-[0_0_12px_rgba(201,168,76,0.55)]'
                        : 'text-[#FFF3B0] hover:text-white'
                    }`}
                  >
                    ✦ RSVP
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      hasAutoSwitchedRef.current = true
                      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current)
                      setShowPersonalGreeting(false)
                    }}
                    className={`px-4 sm:px-5 py-1 landscape:py-0.5 rounded-full font-sans text-[10px] sm:text-xs tracking-[0.18em] uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      !showPersonalGreeting
                        ? 'bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white shadow-[0_0_12px_rgba(201,168,76,0.55)]'
                        : 'text-[#FFF3B0] hover:text-white animate-pulse'
                    }`}
                  >
                    <span>📍</span> VENUE
                  </button>
                </div>

                {showPersonalGreeting ? (
                  /* ── STAGE 1 (4 SECONDS): PERSONALIZED GREETING + RSVP & ADD TO CALENDAR ── */
                  <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-2 sm:px-4 animate-fade-up">
                    {/* Personalized Guest Name */}
                    <h2
                      className="font-marcellus text-lg sm:text-2xl md:text-3xl landscape:text-lg font-bold tracking-[0.16em] uppercase leading-tight mb-1 sm:mb-1.5 landscape:mb-0.5"
                      style={{
                        background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF3B0 35%, #E2BE5A 75%, #C9A84C 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.98)) drop-shadow(0 0 16px rgba(212,175,55,0.5))',
                      }}
                    >
                      {guestName ? `DEAR ${formatGuestTitleCase(guestName).toUpperCase()}` : 'DEAR HONORED GUEST'}
                    </h2>

                    {/* Concise 3-Format Personalized Message */}
                    <div className="font-serif text-xs sm:text-sm landscape:text-xs text-[#FFFDF5] font-medium max-w-lg leading-snug px-2 mb-1.5 sm:mb-2 landscape:mb-1 drop-shadow-[0_2px_6px_rgba(0,0,0,1)] space-y-0.5">
                      {isAttending ? (
                        <>
                          <p className="italic">
                            {isDiwali
                              ? "You’ve confirmed your presence, and our hearts are full! Can’t wait to celebrate the Festival of Lights with you. ✨"
                              : (
                                <>
                                  You&rsquo;ve confirmed your presence, and we&rsquo;re delighted to have you join us for{' '}
                                  <strong className="font-bold not-italic text-[#FFE89E]">40 &amp; FESTIVE</strong>! ✨
                                </>
                              )}
                          </p>
                          <p className="font-bold text-white">
                            The night shines brighter with you! ❤️
                          </p>
                        </>
                      ) : isDeclined ? (
                        <p className="italic">
                          We&rsquo;ll truly miss you! If your plans change, we&rsquo;d be overjoyed to welcome you to the celebration. ✨
                        </p>
                      ) : (
                        <p className="italic">
                          {isDiwali
                            ? "The night won’t be the same without you — join us for an unforgettable Grand Diwali Celebration! ✨"
                            : (
                              <>
                                The night won&rsquo;t be the same without you — join us for an unforgettable evening of{' '}
                                <strong className="font-bold not-italic text-[#FFE89E]">40 &amp; FESTIVE</strong>! ✨
                              </>
                            )}
                        </p>
                      )}
                    </div>

                    {/* Dynamic Status Micro-Badge (Below the message text) */}
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 sm:py-1 landscape:py-0.5 rounded-full border border-[#C9A84C]/80 bg-[#050D1A]/95 backdrop-blur-md mb-2 landscape:mb-1.5 shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
                      <span className="text-[9px] sm:text-[10px] landscape:text-[9px] tracking-[0.18em] uppercase font-bold text-[#FFE89E]">
                        {isAttending
                          ? "✦ COUNTDOWN IS ON • CAN'T WAIT TO CELEBRATE ✦"
                          : isDeclined
                          ? "✦ A SPECIAL REQUEST • WE TRULY MISS YOU ✦"
                          : "✦ RSVP PENDING • STILL WAITING FOR YOUR REPLY ✦"}
                      </span>
                    </div>

                    {/* RSVP & ADD TO CALENDAR BUTTONS (STAGE 1) */}
                    <div className="w-full flex flex-col gap-1.5 sm:gap-2 landscape:gap-1 max-w-md items-center mx-auto">
                      {isAttending ? (
                        <button
                          onClick={handleCalendar}
                          className="w-full max-w-xs py-2 landscape:py-1.5 px-5 glass border-2 border-[#C9A84C]/85 hover:border-[#C9A84C] text-[#FFF3B0] hover:text-white bg-[#C9A84C]/25 hover:bg-[#C9A84C]/35 font-sans font-bold text-xs tracking-[0.16em] uppercase rounded-md shadow-lg shadow-[#C9A84C]/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <span>📅</span> ADD TO CALENDAR
                        </button>
                      ) : (
                        <>
                          {/* Primary RSVP Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectYes() }}
                            className="w-full py-2 sm:py-2.5 landscape:py-1.5 px-5 bg-gradient-to-r from-[#8B1A28] via-[#C9A84C] to-[#E8810A] text-white font-sans font-bold text-xs tracking-[0.18em] uppercase rounded-md shadow-xl shadow-[#C9A84C]/35 border border-[#FFF3B0]/40 hover:brightness-110 active:scale-95 transition-all"
                          >
                            {isDeclined
                              ? "🎉 CHANGE TO YES! I'LL BE THERE"
                              : "YES, I'LL BE THERE"}
                          </button>

                          {/* Secondary Buttons Row: Can't Make It + Add to Calendar */}
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectNo() }}
                              className="w-full py-1.5 sm:py-2 landscape:py-1 px-2.5 glass border border-white/45 bg-black/65 text-white hover:border-white font-sans font-semibold text-[10px] sm:text-xs landscape:text-[10px] tracking-[0.12em] uppercase rounded-md active:scale-95 transition-all flex items-center justify-center"
                            >
                              {isDeclined
                                ? "STILL CAN'T MAKE IT"
                                : "SORRY, CAN'T MAKE IT"}
                            </button>

                            <button
                              onClick={handleCalendar}
                              className="w-full py-1.5 sm:py-2 landscape:py-1 px-2.5 glass border border-[#C9A84C]/85 hover:border-[#C9A84C] text-[#FFF3B0] hover:text-white bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 font-sans font-bold text-[10px] sm:text-xs landscape:text-[10px] tracking-[0.12em] uppercase rounded-md active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              <span>📅</span> ADD TO CALENDAR
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── STAGE 2: ONE-SCREEN VENUE + SIGNOFF ── */
                  <div className="w-full flex flex-col items-center gap-2 sm:gap-2.5 landscape:gap-1 animate-fade-up">

                    {/* 1. VENUE AREA: ROYAL PLAQUE */}
                    <div className="w-full flex justify-center">
                      <div className="relative w-full max-w-md px-4 sm:px-6 py-2.5 sm:py-3 landscape:py-2 rounded-xl border-2 border-[#C9A84C]/80 bg-[#050D1A]/95 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_20px_rgba(201,168,76,0.2)] flex flex-col items-center">
                        {/* Date & Time Header (Single line so it stays compact in landscape) */}
                        <div className="flex items-center justify-center gap-1.5 text-[#FFE89E] font-marcellus text-[11px] sm:text-xs landscape:text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap">
                          <span>🗓️ FRIDAY, OCT 23, 2026</span>
                          <span className="text-[#C9A84C]">•</span>
                          <span>⏰ 8:00 PM ONWARDS</span>
                        </div>

                        <div className="h-[1px] w-28 bg-gradient-to-r from-transparent via-[#C9A84C]/85 to-transparent my-1.5 landscape:my-1" />

                        {/* Venue Name */}
                        <h3
                          className="font-marcellus text-base sm:text-lg md:text-xl landscape:text-base font-bold tracking-[0.15em] uppercase text-center"
                          style={{
                            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF6C8 45%, #E2BE5A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.95))',
                          }}
                        >
                          &ldquo;THE FOOTHILLS VILLAS&rdquo;
                        </h3>

                        {/* Venue Address */}
                        <p className="text-[11px] sm:text-xs landscape:text-[11px] text-white font-sans font-medium tracking-wide mt-0.5 leading-snug text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                          Near RAJASTHALI RESORT &amp; SPA, Kukas, Delhi Road, Jaipur
                        </p>

                        {/* Google Maps Link */}
                        <a
                          href={EVENT.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 landscape:mt-1.5 inline-flex items-center gap-1.5 px-4 py-1 landscape:py-0.5 rounded-full bg-gradient-to-r from-[#C9A84C]/30 via-[#C9A84C]/25 to-[#C9A84C]/30 border border-[#C9A84C]/90 text-[11px] sm:text-xs landscape:text-[10px] font-sans font-semibold text-[#FFF6C8] hover:bg-[#C9A84C]/40 hover:text-white tracking-wider shadow-[0_2px_10px_rgba(201,168,76,0.25)] transition-all"
                        >
                          <span>📍</span> Open in Google Maps ➔
                        </a>
                      </div>
                    </div>

                    {/* 2. SIGNOFF + ADD TO CALENDAR ROW (Compact side-by-side in landscape, stacked in portrait) */}
                    <div className="w-full flex flex-col landscape:flex-row items-center justify-center gap-1.5 landscape:gap-4 mt-0.5">
                      <p className="font-serif italic text-xs sm:text-sm landscape:text-xs text-[#FFE89E] font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                        {isDiwali ? 'Warmly, The Khandelwal Family' : 'Warmly, Tanvi'}
                      </p>

                      <button
                        onClick={handleCalendar}
                        className="w-full max-w-[220px] landscape:w-auto py-1.5 sm:py-2 landscape:py-1 px-4 glass border-2 border-[#C9A84C]/80 hover:border-[#C9A84C] text-[#FFF3B0] hover:text-white bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 font-sans font-bold text-[10px] sm:text-xs landscape:text-[10px] tracking-[0.15em] uppercase rounded-md shadow-lg shadow-[#C9A84C]/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>📅</span> ADD TO CALENDAR
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}
            </div>
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
