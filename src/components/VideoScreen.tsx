'use client'

import { useEffect, useRef, useState } from 'react'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'
import { trackEvent } from '@/lib/supabase'

interface Props {
  guestName?: string
  guestId?: string
  videoUrl?: string
  inviteCode?: string
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
  onSelectYes,
  onSelectNo,
  onStart,
  active
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [videoState, setVideoState] = useState<'loading' | 'playing' | 'ended' | 'unavailable'>('loading')
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(10)
  const [showSkip, setShowSkip] = useState(false)
  const [soundMuted, setSoundMuted] = useState(true)
  const startedRef = useRef(false)
  const endedCalledRef = useRef(false)

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
      a.download = 'arpit40.ics'
      a.click()
    } else {
      window.open(buildGoogleCalUrl(), '_blank')
    }
  }

  useEffect(() => {
    if (!active) return

    const targetUrl = customVideoUrl || EVENT.videoUrl || '/videos/teaser.mp4'
    const video = videoRef.current
    const audio = audioRef.current
    if (!video) return

    video.src = targetUrl
    video.muted = true
    video.defaultMuted = true

    // Show skip button after 2 seconds guaranteed
    const skipTimer = setTimeout(() => setShowSkip(true), 2000)

    // Attempt MUTED autoplay (100% compliant with mobile browser policies)
    const playVideoMuted = () => {
      video.muted = true
      video.play().then(() => {
        setVideoState('playing')
        if (!startedRef.current) {
          startedRef.current = true
          onStart()
        }
      }).catch((err) => {
        console.warn('Muted autoplay failed or restricted:', err)
        setVideoState('playing')
      })
    }

    playVideoMuted()

    // Fallback ticker timer to advance currentTime if video element stalls or fails
    const fallbackTicker = setInterval(() => {
      if (video && !video.paused && video.currentTime > 0) {
        setCurrentTime(video.currentTime)
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration)
        }
      } else {
        // Increment timer synthetically if video is stuck so text beats still advance
        setCurrentTime((prev) => {
          const next = prev + 0.25
          if (next >= duration && !endedCalledRef.current) {
            endedCalledRef.current = true
            setVideoState('ended')
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
      if (audio) audio.pause()
    }

    const handleError = (e: Event) => {
      console.warn('Video load error:', e)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      clearTimeout(skipTimer)
      clearInterval(fallbackTicker)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.pause()
      if (audio) audio.pause()
    }
  }, [active, customVideoUrl, duration, onStart])

  // Handle user interaction (tap anywhere to un-mute and guarantee playback)
  const handleUserInteraction = (e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    const audio = audioRef.current

    if (video) {
      if (video.paused) {
        video.muted = false
        video.play().then(() => {
          setSoundMuted(false)
          setVideoState('playing')
        }).catch(() => {
          video.muted = true
          video.play().catch(() => {})
          setSoundMuted(true)
        })
      } else {
        const nextMuted = !video.muted
        video.muted = nextMuted
        setSoundMuted(nextMuted)
      }
    }

    if (audio && EVENT.audioUrl) {
      if (audio.paused) {
        audio.src = EVENT.audioUrl
        audio.play().catch(() => {})
      } else {
        audio.pause()
      }
    }
  }

  // Teaser Beat calculations based on current time and total video duration
  const beat1End = duration ? duration * 0.33 : 3.3
  const beat2End = duration ? duration * 0.66 : 6.6

  const isBeat1 = videoState !== 'ended' && currentTime < beat1End
  const isBeat2 = videoState !== 'ended' && currentTime >= beat1End && currentTime < beat2End
  const isBeat3 = videoState === 'ended' || currentTime >= beat2End

  return (
    <div
      className="relative w-full full-viewport-height bg-black overflow-hidden select-none cursor-pointer"
      onClick={handleUserInteraction}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        preload="auto"
        poster={EVENT.poster || undefined}
      />

      {/* Optional Audio Element */}
      {EVENT.audioUrl && (
        <audio ref={audioRef} preload="auto" />
      )}

      {/* Dark Vignette Overlay for Crisp Typography Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/80 pointer-events-none" />

      {/* ── MOVIE TEASER DYNAMIC TEXT OVERLAY SEQUENCE ── */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 pointer-events-none z-20">

        {/* Top Header — Clean space */}
        <div className="w-full pt-4 pointer-events-none" />

        {/* CENTER STAGE: SEQUENTIAL TEASER BEATS */}
        <div className="relative w-full flex-1 flex flex-col items-center justify-center text-center">

          {/* BEAT 1: Opening Title Reveal */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat1 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C]/80 mb-3">
              A TIMELESS CELEBRATION
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
              40 & Festive
            </h1>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent my-3" />
            <p className="font-sans text-xs sm:text-sm tracking-[0.3em] uppercase text-[#F5ECD7]/80 font-medium">
              ARPIT'S 40 & DIWALI BASH
            </p>
          </div>

          {/* BEAT 2: Personalized Guest Card */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat2 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C]/80 mb-4">
              A FESTIVE WELCOME TO
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
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#C9A84C]/40 bg-[#050D1A]/70 backdrop-blur-md rounded-full shadow-lg shadow-[#C9A84C]/10">
              <span className="text-[#C9A84C] text-xs">🪔</span>
              <span className="font-sans text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-[#F5ECD7]/90 font-medium">
                JOIN US TO CELEBRATE 40 YEARS OF LIGHT
              </span>
            </div>
          </div>

          {/* BEAT 3: Climax & Interactive CTAs */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/90 mb-2">
              DIWALI VIBES · 40 YEARS · MEMORIES
            </p>
            <h3 className="font-serif text-2xl sm:text-4xl text-[#F5ECD7] font-bold mb-2">
              FRIDAY | OCT 23, 2026
            </h3>
            <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/60 mb-6">
              JAIPUR · RAJASTHAN
            </p>

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
                <span>📅</span> ADD TO CALENDAR
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
