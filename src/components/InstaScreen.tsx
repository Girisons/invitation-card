'use client'

import { useEffect, useState } from 'react'
import { Guest, trackEvent, updateGuestInviteDetails } from '@/lib/supabase'

interface Props {
  guest?: Guest
  inviteCode?: string
}

export default function InstaScreen({ guest, inviteCode }: Props) {
  const [copied, setCopied] = useState(false)
  const [tapped, setTapped] = useState(false)

  // Resolve strictly individual first name or nickname (never couple!)
  const individualName = (guest?.nickname && guest.nickname.trim())
    ? guest.nickname.trim()
    : (guest?.first_name && guest.first_name.trim())
    ? guest.first_name.trim().split(' ')[0]
    : ''

  // Track event and update insta_status = 'seen'
  useEffect(() => {
    if (guest?.id) {
      trackEvent(guest.id, inviteCode || '', 'insta_opened')
      updateGuestInviteDetails(guest.id, { insta_status: 'seen' })
    }
  }, [guest?.id, inviteCode])

  // Deep-link launch logic
  const handleOpenInstagram = () => {
    setTapped(true)
    if (guest?.id) {
      trackEvent(guest.id, inviteCode || '', 'insta_clicked')
    }

    // 1. Direct App Scheme (Deep-Link)
    const appUri = 'instagram://user?username=40andfestive'
    // 2. Universal Link (_u bypasses webview on iOS/Android)
    const universalUri = 'https://www.instagram.com/_u/40andfestive'
    // 3. Fallback Web Profile
    const webUri = 'https://instagram.com/40andfestive'

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)

    if (isAndroid) {
      // Android Intent scheme directly invokes native Instagram app
      const androidIntent = 'intent://instagram.com/_u/40andfestive/#Intent;package=com.instagram.android;scheme=https;end'
      window.location.href = androidIntent
      setTimeout(() => {
        window.location.href = universalUri
      }, 600)
    } else if (isIOS) {
      // iOS app protocol with universal link fallback
      window.location.href = appUri
      setTimeout(() => {
        window.location.href = universalUri
      }, 600)
    } else {
      // Desktop / Web
      window.open(webUri, '_blank')
    }
  }

  // Attempt automatic launch on mobile after short delay
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile) {
      const timer = setTimeout(() => {
        // Soft deep-link attempt
        const appUri = 'instagram://user?username=40andfestive'
        window.location.href = appUri
      }, 900)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <div
      onClick={handleOpenInstagram}
      className="relative w-full h-[100dvh] bg-[#02050B] flex items-center justify-center overflow-hidden cursor-pointer select-none"
    >
      {/* 9:16 Portrait Canvas */}
      <div className="relative w-full max-w-[480px] h-full max-h-[920px] aspect-[9/16] shadow-2xl overflow-hidden flex flex-col justify-between">
        
        {/* Background Artwork */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/insta-bg.png"
          alt="40 &amp; Festive — Instagram"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Dynamic Personalised Individual Name (Positioned above Share the celebration) */}
        {individualName && (
          <div
            className="absolute left-0 right-0 text-center pointer-events-none"
            style={{ top: '61.8%' }}
          >
            <p
              className="text-[#FFF2C2] text-sm sm:text-base tracking-[0.22em] font-serif uppercase font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              style={{
                textShadow: '0 0 12px rgba(229,190,114,0.6), 0 2px 4px #000000',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFE699 40%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DEAR {individualName.toUpperCase()}
            </p>
          </div>
        )}

        {/* Interactive Pill Button Overlay (Positioned exactly over the button in background) */}
        <div
          className="absolute left-0 right-0 flex justify-center items-center"
          style={{ top: '74.2%', height: '7.5%' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenInstagram()
            }}
            className="relative w-[68%] h-[88%] rounded-full flex items-center justify-center gap-2.5 transition-all duration-200 transform active:scale-95 group focus:outline-none"
            style={{
              background: 'linear-gradient(180deg, rgba(229,190,114,0.12) 0%, rgba(186,136,56,0.22) 100%)',
              boxShadow: '0 0 20px rgba(212,175,55,0.35), inset 0 0 10px rgba(255,248,224,0.25)',
            }}
            title="Tap to open @40andfestive in Instagram"
          >
            {/* Shimmering pulse border ring */}
            <span
              className="absolute -inset-1 rounded-full border border-amber-300/40 animate-pulse pointer-events-none"
              style={{ animationDuration: '2s' }}
            />

            {/* Official Instagram Camera SVG Icon */}
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#FFE58F] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.8" />
            </svg>

            {/* Handle Text in Gold Calligraphic Serif */}
            <span
              className="font-serif text-xs sm:text-sm font-bold tracking-wider uppercase text-[#FFF3CC] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFE28A 45%, #D4A836 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              @40andfestive
            </span>
          </button>
        </div>

        {/* Gentle hint at bottom */}
        <div
          className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ bottom: '4%' }}
        >
          <span className="text-[10px] tracking-widest uppercase text-amber-200/50 font-mono">
            {tapped ? 'Opening Instagram...' : 'Tap anywhere to open Instagram'}
          </span>
        </div>

      </div>
    </div>
  )
}
