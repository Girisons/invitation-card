'use client'

import { useState, useEffect } from 'react'
import { Guest, submitRSVP, trackEvent } from '@/lib/supabase'
import { EVENT, buildGoogleCalUrl, buildICSContent } from '@/lib/config'

interface Props {
  guest: Guest
  guestName: string
  onComplete: (status: 'attending' | 'declined') => void
  active: boolean
}

export default function RSVPScreen({ guest, guestName, onComplete, active }: Props) {
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) setTimeout(() => setVisible(true), 100)
    else setVisible(false)
  }, [active])

  const handleCalendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (guest?.id) trackEvent(guest.id, '', 'calendar_clicked')
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      const ics = buildICSContent()
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'arpit_40th_diwali.ics'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      window.open(buildGoogleCalUrl(), '_blank')
    }
  }

  const handleYes = async () => {
    setLoading(true)
    trackEvent(guest.id, '', 'rsvp_attending')
    await submitRSVP(guest.id, 'attending', guest.invited_count || 1)
    setLoading(false)
    onComplete('attending')
  }

  const handleNo = async () => {
    setLoading(true)
    trackEvent(guest.id, '', 'rsvp_declined')
    await submitRSVP(guest.id, 'declined', 0)
    setLoading(false)
    onComplete('declined')
  }

  return (
    <div className="w-full full-viewport-height overflow-y-auto overscroll-contain bg-[#050D1A] safe-top safe-bottom">
      <div className={`min-h-full flex flex-col px-6 py-12 max-w-sm mx-auto transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>

        {/* DECISION STEP */}
        <div className="flex flex-col items-center text-center my-auto">
          <div className="flame-animate text-4xl mb-10 text-amber-400" style={{ filter: 'drop-shadow(0 0 16px rgba(232,129,10,0.7))' }}>◆</div>

          <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/50 mb-3">
            RSVP INVITATION
          </p>
          <h2 className="font-serif text-3xl font-bold text-[#F5ECD7] mb-3 leading-tight">
            {guestName}
          </h2>
          <p className="font-sans text-xs tracking-[0.25em] uppercase text-[#C9A84C]/70 mb-10">
            {EVENT.date} · {EVENT.city}
          </p>

          <p className="font-sans text-sm text-[#F5ECD7]/60 mb-8 tracking-wide">
            Will you be joining us for the celebration?
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleYes}
              disabled={loading}
              className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase shadow-lg shadow-[#C9A84C]/15"
            >
              {loading ? 'Saving…' : "Yes, I'll be there"}
            </button>
            <button
              onClick={handleNo}
              disabled={loading}
              className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase opacity-60 hover:opacity-100"
            >
              {loading ? 'Saving…' : "Sorry, can't make it"}
            </button>
            <button
              onClick={handleCalendar}
              className="w-full py-3.5 px-6 glass border border-[#C9A84C]/50 text-[#C9A84C] font-sans font-semibold text-xs tracking-[0.2em] uppercase rounded-sm hover:bg-[#C9A84C]/10 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>📅</span> Add to Calendar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
