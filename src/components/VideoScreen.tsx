'use client'

import { useEffect, useRef, useState } from 'react'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'
import { trackEvent } from '@/lib/supabase'

interface Props {
  guestName?: string
  guestId?: string
  videoUrl?: string
  inviteCode?: string
  onEnd: () => void
  onStart: () => void
  onSkip: () => void
  active: boolean
}

export default function VideoScreen({
  guestName,
  guestId,
  videoUrl: customVideoUrl,
  inviteCode,
  onEnd,
  onStart,
  onSkip,
  active
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [videoState, setVideoState] = useState<'loading' | 'playing' | 'ended' | 'unavailable'>('loading')
  const [activeUrl, setActiveUrl] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(10)
  const [showSkip, setShowSkip] = useState(false)
  const [soundMuted, setSoundMuted] = useState(true)
  const startedRef = useRef(false)

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

    // Resolve video URL priority:
    // 1. Explicit guest custom video URL
    // 2. Global default video URL from config
    // 3. Fallback video path
    const targetUrl = customVideoUrl || EVENT.videoUrl || '/videos/teaser.mp4'
    setActiveUrl(targetUrl)

    const video = videoRef.current
    const audio = audioRef.current
    if (!video) return

    video.src = targetUrl
    video.muted = true

    // Show skip after 3 seconds
    const skipTimer = setTimeout(() => setShowSkip(true), 3000)

    const playVideo = async () => {
      try {
        await video.play()
        setVideoState('playing')
        if (!startedRef.current) { startedRef.current = true; onStart() }

        // Try unmuting sound automatically if permitted
        try {
          video.muted = false
          setSoundMuted(false)
        } catch {
          video.muted = true
          setSoundMuted(true)
        }

        if (audio && EVENT.audioUrl) {
          audio.src = EVENT.audioUrl
          audio.play().catch(() => {})
        }
      } catch (err) {
        console.warn('Autoplay attempt:', err)
        video.muted = true
        video.play().then(() => {
          setVideoState('playing')
          setSoundMuted(true)
          if (!startedRef.current) { startedRef.current = true; onStart() }
        }).catch(() => {
          setVideoState('playing')
        })
      }
    }

    playVideo()

    const handleTimeUpdate = () => {
      if (video) {
        setCurrentTime(video.currentTime)
        if (video.duration && !isNaN(video.duration)) {
          setDuration(video.duration)
        }
      }
    }

    const handleEnded = () => {
      setVideoState('ended')
      // Wait 3.5 seconds on the final frame & end screen before navigating to RSVP
      setTimeout(() => {
        if (audio) audio.pause()
        onEnd()
      }, 3500)
    }

    const handleError = (e: Event) => {
      console.warn('Video load error:', e)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      clearTimeout(skipTimer)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.pause()
      if (audio) audio.pause()
    }
  }, [active, customVideoUrl, onEnd, onStart])

  // Sound toggle button
  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted
      videoRef.current.muted = nextMuted
      setSoundMuted(nextMuted)
    }
    if (audioRef.current) {
      if (audioRef.current.paused) audioRef.current.play().catch(() => {})
      else audioRef.current.pause()
    }
  }

  // Auto-scale Beat logic based on actual video duration:
  // Beat 1: First 33% of video
  // Beat 2: Middle 33% of video
  // Beat 3: Final 33% of video + 3.5s pause on final frame
  const beat1End = duration ? duration * 0.33 : 3.3
  const beat2End = duration ? duration * 0.66 : 6.6

  const isBeat1 = videoState !== 'ended' && currentTime < beat1End
  const isBeat2 = videoState !== 'ended' && currentTime >= beat1End && currentTime < beat2End
  const isBeat3 = videoState === 'ended' || currentTime >= beat2End

  return (
    <div
      className="relative w-full h-dvh bg-black overflow-hidden select-none cursor-pointer"
      onClick={toggleSound}
    >

      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        muted
        autoPlay
        preload="auto"
        poster={EVENT.poster || undefined}
      />

      {/* Optional Custom Audio Element */}
      {EVENT.audioUrl && (
        <audio ref={audioRef} preload="auto" />
      )}

      {/* Dark Vignette Overlay for Crisp Typography Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/80 pointer-events-none" />

      {/* ── MOVIE TEASER DYNAMIC TEXT OVERLAY SEQUENCE ── */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 pointer-events-none z-20">

        {/* Top Header Tag */}
        <div className="flex justify-between items-center w-full pt-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/90">
              #40AndFestive
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-white/40">
            {Math.floor(currentTime)}s / {Math.floor(duration)}s
          </span>
        </div>

        {/* CENTER STAGE: SEQUENTIAL TEASER BEATS */}
        <div className="relative w-full flex-1 flex flex-col items-center justify-center text-center">

          {/* BEAT 1 (0:00 - 0:03.3): Opening Title Reveal */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat1 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/70 mb-3">
              AN EXCLUSIVE CELEBRATION
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
            <p className="font-sans text-xs sm:text-sm tracking-[0.3em] uppercase text-[#F5ECD7]/80">
              ARPIT @ 40 × DIWALI
            </p>
          </div>

          {/* BEAT 2 (0:03.3 - 0:06.6): Personalized Guest Card */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat2 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.45em] uppercase text-[#C9A84C]/80 mb-4">
              A PERSONAL INVITATION FOR
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-[#C9A84C]/30 bg-[#050D1A]/60 backdrop-blur-md rounded-full">
              <span className="text-[#C9A84C] text-xs">🪔</span>
              <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-[#F5ECD7]/90">
                JOIN US FOR AN UNFORGETTABLE NIGHT
              </span>
            </div>
          </div>

          {/* BEAT 3 (0:06.6 - 0:10.0+): Climax & Interactive CTAs */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
            isBeat3 ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <p className="font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C9A84C]/90 mb-2">
              DRINKS · DANCE · CELEBRATION
            </p>
            <h3 className="font-serif text-2xl sm:text-4xl text-[#F5ECD7] font-bold mb-2">
              SATURDAY | OCT 23, 2026
            </h3>
            <p className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/60 mb-6">
              JAIPUR · RAJASTHAN
            </p>

            {/* Interactive CTAs inside Video Climax */}
            <div className="flex flex-col gap-3 w-full max-w-xs px-4">
              <button
                onClick={handleCalendar}
                className="w-full py-3 px-6 bg-gradient-to-r from-[#C9A84C] to-[#E8D5A3] text-black font-sans font-semibold text-xs tracking-[0.2em] uppercase rounded-sm shadow-lg shadow-[#C9A84C]/20 hover:brightness-110 active:scale-95 transition-all"
              >
                📅 Add to Calendar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSkip() }}
                className="w-full py-3 px-6 glass border border-[#C9A84C]/40 text-[#F5ECD7] font-sans font-medium text-xs tracking-[0.2em] uppercase rounded-sm hover:bg-[#C9A84C]/10 active:scale-95 transition-all"
              >
                ✉️ RSVP Now
              </button>
            </div>
          </div>

        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <div className="w-full pb-4 flex justify-between items-center pointer-events-auto">
          <button
            onClick={toggleSound}
            className="glass px-4 py-2 rounded-full border border-[#C9A84C]/40 flex items-center gap-2 hover:bg-[#C9A84C]/10 transition-all active:scale-95 animate-pulse"
          >
            <span className="text-amber-400 text-xs">{soundMuted ? '🔇' : '🔊'}</span>
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A84C]">
              {soundMuted ? 'Tap for Sound' : 'Sound On'}
            </span>
          </button>

          {showSkip && (
            <button
              onClick={(e) => { e.stopPropagation(); onSkip() }}
              className="font-sans text-[11px] tracking-[0.25em] uppercase text-white/60 hover:text-white transition-colors bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full"
            >
              Skip to RSVP →
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
