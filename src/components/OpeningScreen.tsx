'use client'

import { useEffect, useState } from 'react'
import { EVENT } from '@/lib/config'

interface Props {
  guestName: string
  onEnter: () => void
}

export default function OpeningScreen({ guestName, onEnter }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative w-full h-dvh flex flex-col items-center justify-center safe-top safe-bottom px-8 overflow-hidden">

      {/* Ambient background glow — top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full ambient-glow pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Diya flame — top center decorative */}
      <div className={`absolute top-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center transition-opacity duration-[2000ms] ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flame-animate text-amber-400 text-3xl" style={{ filter: 'drop-shadow(0 0 12px rgba(232,129,10,0.8))' }}>
          ◆
        </div>
        <div className="w-[1px] h-10 bg-gradient-to-b from-amber-400/40 to-transparent mt-1" />
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center text-center w-full max-w-sm">

        {/* Eyebrow */}
        <p
          className={`font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/40 mb-8 transition-all duration-[1200ms] delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          A Personal Invitation For
        </p>

        {/* Guest name — the hero */}
        <h1
          className={`font-serif font-bold leading-[1.05] mb-6 transition-all duration-[1400ms] delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{
            fontSize: 'clamp(2rem, 10vw, 3.5rem)',
            background: 'linear-gradient(135deg, #E8D5A3 0%, #C9A84C 40%, #E8D5A3 70%, #C9A84C 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {guestName}
        </h1>

        {/* Divider */}
        <div className={`divider mb-8 transition-all duration-[1000ms] delay-700 ${visible ? 'opacity-100' : 'opacity-0'}`} />

        {/* Event details */}
        <div className={`flex flex-col gap-2 mb-12 transition-all duration-[1200ms] delay-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#C9A84C]/50">
            40 & Festive
          </p>
          <p className="font-serif text-xl text-[#F5ECD7]/80 tracking-wide">
            {EVENT.name}
          </p>
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-[#F5ECD7]/35 mt-1">
            {EVENT.date} · {EVENT.city}
          </p>
        </div>

        {/* Enter button */}
        <button
          onClick={onEnter}
          className={`group relative transition-all duration-[1400ms] delay-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="flex items-center gap-4 px-10 py-4 border border-[#C9A84C]/20 rounded-sm hover:border-[#C9A84C]/50 transition-colors duration-300">
            <span className="font-sans text-[11px] tracking-[0.35em] uppercase text-[#C9A84C]/70 group-hover:text-[#C9A84C] transition-colors duration-300">
              Enter Invitation
            </span>
            <span className="text-[#C9A84C]/40 group-hover:text-[#C9A84C] transition-all duration-300 group-hover:translate-x-1">
              →
            </span>
          </div>
        </button>
      </div>

      {/* Bottom ambient glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(107,26,40,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Very subtle jaali pattern at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%23C9A84C'/%3E%3Cpath d='M0 20h40M20 0v40' stroke='%23C9A84C' stroke-width='0.3'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
