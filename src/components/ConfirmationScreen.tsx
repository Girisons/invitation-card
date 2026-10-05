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

export default function ConfirmationScreen({ guest, guestName, status }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 150)
  }, [])

  const handleCalendar = () => {
    trackEvent(guest.id, '', 'calendar_clicked')
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
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
      <div className={`w-full h-dvh flex flex-col items-center justify-center px-8 safe-top safe-bottom bg-[#050D1A] transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
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
    <div className={`w-full h-dvh overflow-y-auto overscroll-contain bg-[#050D1A] safe-top safe-bottom transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="min-h-dvh flex flex-col items-center justify-center px-8 py-16 max-w-sm mx-auto">

        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.09) 0%, transparent 70%)' }}
        />

        <div className="flex flex-col items-center text-center w-full">
          {/* Flame Icon */}
          <div className="flame-animate text-5xl mb-8 text-amber-400" style={{ filter: 'drop-shadow(0 0 20px rgba(232,129,10,0.9))' }}>◆</div>

          {/* Headline */}
          <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/60 mb-3">
            RSVP CONFIRMED
          </p>
          <h2
            className="font-serif font-bold mb-4 leading-tight text-4xl"
            style={{
              background: 'linear-gradient(135deg, #FFF6D6 0%, #E8D5A3 50%, #C9A84C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.5))',
            }}
          >
            Thank You!
          </h2>

          <p className="font-serif text-lg text-[#F5ECD7] mb-3 leading-relaxed italic">
            We will be eagerly waiting for you.
          </p>

          <p className="font-sans text-xs tracking-[0.25em] uppercase text-[#C9A84C]/50 mb-10">
            {EVENT.date} · {EVENT.city}
          </p>

          {/* Thin divider */}
          <div className="divider mb-10" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 w-full">
            <button onClick={handleCalendar} className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase shadow-lg shadow-[#C9A84C]/10">
              📅 Add to Calendar
            </button>
            <button onClick={handleWhatsApp} className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase">
              💬 Message Vipul
            </button>
          </div>

          {/* Bottom signature */}
          <p className="font-serif italic text-[#F5ECD7]/30 text-sm mt-12">
            See you on the 23rd! 🪔
          </p>
        </div>
      </div>
    </div>
  )
}
