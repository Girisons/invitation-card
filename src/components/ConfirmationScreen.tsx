'use client'

import { useEffect, useState } from 'react'
import { Guest, trackEvent } from '@/lib/supabase'
import { EVENT, WHATSAPP_URL, buildGoogleCalUrl, buildICSContent } from '@/lib/config'

interface Props {
  guest: Guest
  guestName: string
  status: 'attending' | 'declined' | null
  onBack: () => void
}

export default function ConfirmationScreen({ guest, guestName, status, onBack }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 150)
  }, [])

  const handleCalendar = () => {
    trackEvent(guest.id, '', 'calendar_clicked')
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
      // Download ICS
      const ics = buildICSContent()
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'arpit40.ics'; a.click()
    } else {
      window.open(buildGoogleCalUrl(), '_blank')
    }
  }

  const handleWhatsApp = () => {
    trackEvent(guest.id, '', 'whatsapp_clicked')
    window.open(WHATSAPP_URL, '_blank')
  }

  if (status === 'declined') {
    return (
      <div className={`w-full h-dvh flex flex-col items-center justify-center px-8 safe-top safe-bottom transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="text-4xl mb-10 opacity-30">◆</div>
          <h2 className="font-serif text-3xl text-[#F5ECD7] mb-4">We'll miss you.</h2>
          <p className="font-sans text-sm text-[#F5ECD7]/40 mb-12 tracking-wide">
            Thank you for letting us know.
          </p>

          <button onClick={handleWhatsApp} className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase mb-4">
            Message Vipul
          </button>
          <p className="font-sans text-[10px] text-[#F5ECD7]/25 tracking-wide">
            Send us a message if your plans change.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full h-dvh overflow-y-auto overscroll-contain safe-top safe-bottom transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="min-h-dvh flex flex-col items-center justify-center px-8 py-16 max-w-sm mx-auto">

        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 70%)' }}
        />

        <div className="flex flex-col items-center text-center w-full">
          {/* Diya */}
          <div className="flame-animate text-5xl mb-10 text-amber-400" style={{ filter: 'drop-shadow(0 0 20px rgba(232,129,10,0.9))' }}>◆</div>

          {/* Headline */}
          <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/40 mb-3">
            You're on the list
          </p>
          <h2
            className="font-serif font-bold mb-2 leading-tight"
            style={{
              fontSize: 'clamp(1.8rem, 8vw, 2.8rem)',
              background: 'linear-gradient(135deg, #E8D5A3, #C9A84C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {guestName}
          </h2>
          <p className="font-sans text-xs tracking-[0.25em] text-[#F5ECD7]/35 mb-12">
            {EVENT.date} · {EVENT.city}
          </p>

          {/* Thin divider */}
          <div className="divider mb-12" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 w-full">
            <button onClick={handleCalendar} className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase">
              Add to Calendar
            </button>
            <button onClick={handleWhatsApp} className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase">
              Message Vipul
            </button>
            <button
              onClick={onBack}
              className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/20 hover:text-white/40 transition-colors py-3"
            >
              ← Back to Invitation
            </button>
          </div>

          {/* Bottom signature */}
          <p className="font-serif italic text-[#F5ECD7]/20 text-sm mt-12">
            See you on the 23rd. 🪔
          </p>
        </div>
      </div>
    </div>
  )
}
