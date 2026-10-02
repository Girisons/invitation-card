'use client'

import { useEffect, useRef, useState } from 'react'
import { EVENT } from '@/lib/config'

interface Props {
  onEnd: () => void
  onStart: () => void
  onSkip: () => void
  active: boolean
}

export default function VideoScreen({ onEnd, onStart, onSkip, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [videoState, setVideoState] = useState<'loading' | 'playing' | 'ended' | 'unavailable'>('loading')
  const [showSkip, setShowSkip] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!active || !videoRef.current) return

    const video = videoRef.current
    const videoUrl = EVENT.videoUrl

    if (!videoUrl) {
      // No video — show placeholder, go to RSVP after 3s
      setVideoState('unavailable')
      const t = setTimeout(() => onEnd(), 3000)
      return () => clearTimeout(t)
    }

    video.src = videoUrl
    video.muted = false

    // Show skip after 5 seconds
    const skipTimer = setTimeout(() => setShowSkip(true), 5000)

    const tryPlay = async () => {
      try {
        await video.play()
        setSoundBlocked(false)
        setVideoState('playing')
        if (!startedRef.current) { startedRef.current = true; onStart() }
      } catch {
        // Try muted autoplay
        video.muted = true
        try {
          await video.play()
          setSoundBlocked(true)
          setVideoState('playing')
          if (!startedRef.current) { startedRef.current = true; onStart() }
        } catch {
          setVideoState('unavailable')
          setTimeout(() => onEnd(), 3000)
        }
      }
    }

    tryPlay()

    const handleEnded = () => {
      setVideoState('ended')
      setTimeout(() => onEnd(), 800)
    }

    video.addEventListener('ended', handleEnded)
    return () => {
      clearTimeout(skipTimer)
      video.removeEventListener('ended', handleEnded)
      video.pause()
    }
  }, [active, onEnd, onStart])

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false
      videoRef.current.play()
      setSoundBlocked(false)
    }
  }

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">

      {/* Video element */}
      {EVENT.videoUrl && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster={EVENT.poster || undefined}
        />
      )}

      {/* Unavailable / placeholder state */}
      {videoState === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050D1A]">
          <div className="flame-animate text-6xl mb-8" style={{ filter: 'drop-shadow(0 0 20px rgba(232,129,10,0.8))' }}>◆</div>
          <p className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/50 mb-3">
            Invitation Film
          </p>
          <p className="font-serif text-2xl text-[#F5ECD7]/60 mb-2">{EVENT.name}</p>
          <p className="font-sans text-xs tracking-[0.2em] text-[#F5ECD7]/30">{EVENT.date} · {EVENT.city}</p>
          <p className="font-sans text-[10px] text-[#C9A84C]/30 mt-8 tracking-widest uppercase">
            Film coming soon…
          </p>
        </div>
      )}

      {/* Tap for sound */}
      {soundBlocked && videoState === 'playing' && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 glass px-6 py-3 rounded-full transition-opacity duration-300 hover:opacity-80"
        >
          <span className="font-sans text-[11px] tracking-[0.25em] uppercase text-[#C9A84C]/80">
            Tap for Sound
          </span>
        </button>
      )}

      {/* Skip — subtle, appears after 5s */}
      {showSkip && videoState === 'playing' && (
        <button
          onClick={onSkip}
          className="absolute bottom-8 right-6 font-sans text-[10px] tracking-[0.25em] uppercase text-white/20 hover:text-white/40 transition-colors duration-300"
        >
          Skip →
        </button>
      )}

      {/* Top fade for polish */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  )
}
