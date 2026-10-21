'use client'

import { useEffect, useState } from 'react'
import { Guest, trackEvent, updateGuestInviteDetails } from '@/lib/supabase'

interface Props {
  guest?: Guest
  inviteCode?: string
}

export default function InstaScreen({ guest, inviteCode }: Props) {
  const [tapped, setTapped] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // Resolve strictly individual first name or nickname (never couple!)
  const individualName = (guest?.nickname && guest.nickname.trim())
    ? guest.nickname.trim()
    : (guest?.first_name && guest.first_name.trim())
    ? guest.first_name.trim().split(' ')[0]
    : ''

  // Track event, update insta_status = 'seen', and stay for 5 seconds before opening Instagram
  useEffect(() => {
    if (guest?.id) {
      trackEvent(guest.id, inviteCode || '', 'insta_opened')
      updateGuestInviteDetails(guest.id, { insta_status: 'seen' })
    }

    // 1-second interval to tick down from 5 to 0
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto-launch Instagram exactly after 5 seconds
    const timer = setTimeout(() => {
      handleOpenInstagram()
    }, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [guest?.id, inviteCode])

  // Deep-link launch logic
  const handleOpenInstagram = () => {
    setTapped(true)
    setCountdown(0)
    if (guest?.id) {
      trackEvent(guest.id, inviteCode || '', 'insta_clicked')
    }

    // 1. Direct App Scheme (Deep-Link)
    const appUri = 'instagram://user?username=40andfestive'
    // 2. Universal Link (_u directly triggers iOS/Android app handoff)
    const universalUri = 'https://www.instagram.com/_u/40andfestive'
    // 3. Fallback Web Profile
    const webUri = 'https://instagram.com/40andfestive'

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)

    if (isAndroid) {
      // Android Intent scheme directly invokes native Instagram app without prompt
      const androidIntent = 'intent://instagram.com/_u/40andfestive/#Intent;package=com.instagram.android;scheme=https;end'
      window.location.href = androidIntent
      setTimeout(() => {
        window.location.href = universalUri
      }, 500)
    } else if (isIOS) {
      // iOS: Try app scheme and universal link handoff
      window.location.href = appUri
      setTimeout(() => {
        window.location.href = universalUri
      }, 500)
    } else {
      // Desktop / Web
      window.open(webUri, '_blank')
    }
  }

  return (
    <div
      onClick={handleOpenInstagram}
      className="relative w-full h-[100dvh] bg-gradient-to-b from-[#020A15] to-[#081827] flex items-center justify-center overflow-hidden cursor-pointer select-none"
    >
      {/* 571:1024 Portrait Canvas (Matches artwork aspect ratio perfectly) */}
      <div className="relative w-full max-w-[480px] h-full max-h-[100dvh] aspect-[571/1024] shadow-2xl overflow-hidden flex flex-col justify-between">
        
        {/* Background Artwork */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/insta-bg.png"
          alt="40 &amp; Festive — Instagram"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Dynamic Personalised Golden Box Content (Matches central glowing box) */}
        <div
          className="absolute flex flex-col items-center justify-center text-center px-4 pointer-events-none"
          style={{
            top: '41.7%',
            left: '14%',
            width: '72%',
            height: '16.8%',
          }}
        >
          {/* Top Hook */}
          <div
            className="text-[12px] sm:text-[14px] font-extrabold tracking-[0.14em] uppercase mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
            style={{
              fontFamily: 'var(--font-cinzel), serif',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFE89E 50%, #E5BE72 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            THE PARTY • THE PEOPLE • THE REELS
          </div>

          {/* Guest Personalization */}
          <div className="font-sans text-[11px] sm:text-[12.5px] text-white/95 leading-snug mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] max-w-[340px]">
            {individualName ? (
              <>
                Hey <strong className="text-[#FFE699] font-bold">{individualName}</strong>, your access to our celebration continues on Instagram.
              </>
            ) : (
              <>Your access to our celebration continues on Instagram.</>
            )}
          </div>

          {/* Subtitle */}
          <div className="font-sans text-[9.5px] sm:text-[11px] text-[#E5D0A1]/85 leading-snug max-w-[320px]">
            Watch the cameraman&apos;s reels &amp; catch the celebration moments.
          </div>
        </div>

        {/* Interactive Hit-target Overlay directly over the bottom [ OPEN INSTAGRAM ➔ ] ribbon */}
        <div
          className="absolute flex justify-center items-center"
          style={{
            top: '81.8%',
            left: '13.6%',
            width: '72.8%',
            height: '8.1%',
          }}
        >
          <a
            href="https://www.instagram.com/_u/40andfestive"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenInstagram()
            }}
            className="relative w-full h-full rounded-2xl flex items-center justify-center transition-all duration-200 transform active:scale-95 group focus:outline-none"
            style={{
              background: 'transparent',
            }}
            title="Tap to open @40andfestive in Instagram"
          >
            {/* Subtle shimmering gold glow around the button on hover/pulse */}
            <span
              className="absolute -inset-1 rounded-2xl border border-amber-300/30 group-hover:border-amber-300/60 animate-pulse pointer-events-none"
              style={{ animationDuration: '2.5s' }}
            />
          </a>
        </div>

        {/* Gentle hint & 5s countdown at bottom */}
        <div
          className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ bottom: '2%' }}
        >
          <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-mono">
            {tapped || countdown === 0
              ? 'Opening Instagram (@40andfestive)...'
              : `Opening Instagram in ${countdown}s · Tap to open now`}
          </span>
        </div>

      </div>
    </div>
  )
}
