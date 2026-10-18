'use client'

import { useEffect, useState } from 'react'
import { Guest, trackEvent } from '@/lib/supabase'
import { EVENT, DIWALI_EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'

interface Props {
  guest: Guest
  guestName: string
  status: 'attending' | 'declined' | null
  inviteType?: string
  onBack: () => void
}

export default function ConfirmationScreen({ guest, guestName, status, inviteType, onBack }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 150)
  }, [])

  const isDiwali = Boolean(
    inviteType === 'save_date_diwali' ||
    inviteType === 'std_diwali' ||
    inviteType === 'diwali' ||
    inviteType === 'main_diwali' ||
    inviteType === 'invite_diwali' ||
    inviteType === 'diwali_main' ||
    inviteType?.includes('diwali')
  )

  const handleCalendar = () => {
    trackEvent(guest.id, '', 'calendar_clicked')
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
      const ics = buildICSContent(isDiwali)
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isDiwali ? 'diwali-celebration.ics' : 'arpit40.ics'
      a.click()
    } else {
      window.open(buildGoogleCalUrl(isDiwali), '_blank')
    }
  }

  const handleWhatsApp = () => {
    trackEvent(guest.id, '', 'whatsapp_clicked')
    const phone = isDiwali ? DIWALI_EVENT.phone.replace(/\D/g, '') : EVENT.phone.replace(/\D/g, '')
    let msg = ''
    if (status === 'attending') {
      msg = isDiwali
        ? `\u2728 Hi Vipul!\nWe’re super excited to join in for the Diwali Party celebration. Looking forward to seeing everyone on Friday, 23rd October 2026 and celebrating with Arpit, Vipul, Jitu & the entire Khandelwal family!\n\n— ${guestName} \u2728`
        : `\u2728 Hi Tanvi!\nWe’re super excited to join in for Arpit’s 40th birthday and Diwali celebration. Looking forward to seeing you on Friday, 23rd October 2026 and being part of the double celebration!\n\n— ${guestName} \u2728`
    } else {
      msg = isDiwali
        ? `Hi Vipul! Unfortunately I won't be able to make it for the Diwali Party celebration. Sending my warmest wishes to Arpit, Vipul, Jitu & the entire family!\n\n— ${guestName}`
        : `Hi Tanvi! Unfortunately I won't be able to make it for Arpit's 40th & Diwali celebration. Sending my warmest wishes to Arpit & family!\n\n— ${guestName}`
    }
    const targetUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(targetUrl, '_blank')
  }

  if (status === 'declined') {
    return (
      <div className={`w-full full-viewport-height flex flex-col items-center justify-center px-8 safe-top safe-bottom bg-[#050D1A] transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="text-4xl mb-10 opacity-30">◆</div>
          <h2 className="font-serif text-3xl text-[#F5ECD7] mb-4">We'd be sad without you.</h2>
          <p className="font-sans text-sm text-[#F5ECD7]/60 mb-12 tracking-wide leading-relaxed">
            Your presence will make the night truly special — we'd love for you to reconsider.
          </p>

          <button onClick={handleWhatsApp} className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase mb-4">
            {isDiwali ? 'Message Vipul Khandelwal' : 'Message Tanvi'}
          </button>
          <button onClick={onBack} className="text-xs text-[#C9A84C]/80 hover:text-[#C9A84C] underline tracking-wider uppercase mb-6 transition-all">
            🔄 Change Response
          </button>
          <p className="font-sans text-xs text-[#C9A84C]/60 tracking-wide">
            Plans can change… and we'll be waiting to celebrate with you.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full full-viewport-height overflow-y-auto overscroll-contain bg-[#050D1A] safe-top safe-bottom transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="min-h-full flex flex-col items-center justify-center px-8 py-16 max-w-sm mx-auto">

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

          <p className="font-sans text-xs tracking-[0.2em] uppercase text-[#FCE18F] font-semibold mb-1">
            {EVENT.date} · 8:00 PM ONWARDS
          </p>
          <p className="font-marcellus text-base text-white tracking-wider uppercase mb-0.5">
            &ldquo;THE FOOTHILLS VILLAS&rdquo;
          </p>
          <p className="font-sans text-[11px] text-[#F5ECD7]/70 mb-2 max-w-xs">
            Near Rajasthali Resort &amp; Spa, Kukas, Delhi Road, Jaipur
          </p>
          <a
            href={EVENT.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#FCE18F] hover:text-white underline decoration-[#C9A84C]/60 underline-offset-4 tracking-wider mb-6 transition-colors"
          >
            <span>📍</span> Open Location in Google Maps ➔
          </a>

          {/* Thin divider */}
          <div className="divider mb-10" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 w-full">
            <button onClick={handleCalendar} className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase shadow-lg shadow-[#C9A84C]/10">
              📅 Add to Calendar
            </button>
            <button onClick={handleWhatsApp} className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase">
              💬 {isDiwali ? 'Message Vipul Khandelwal' : 'Message Tanvi'}
            </button>
            <button onClick={onBack} className="text-xs text-[#C9A84C]/70 hover:text-[#C9A84C] underline tracking-wider uppercase py-2 transition-all">
              🔄 Change RSVP Selection
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
