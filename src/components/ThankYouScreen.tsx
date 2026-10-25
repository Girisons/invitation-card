'use client'

import { useEffect, useState } from 'react'
import { Guest, trackEvent, updateGuestInviteDetails } from '@/lib/supabase'
import {
  ThankYouVariant,
  ThankYouTheme,
  resolveGuestDisplayName,
  resolveGuestAndPartnerNames,
  resolveGuestThankYouTheme,
  getThankYouCardCopy,
} from '@/lib/thankYouCard'

interface Props {
  guest: Guest
  inviteCode: string
  variant: ThankYouVariant
  theme?: ThankYouTheme
}

function renderFormattedParagraph(
  text: string,
  highlight?: string,
  isAttended: boolean = true
) {
  if (!highlight || !text.toLowerCase().includes(highlight.toLowerCase())) {
    return text
  }

  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, idx) => {
    if (part.toLowerCase() === highlight.toLowerCase()) {
      return (
        <strong
          key={idx}
          className="font-bold tracking-wide"
          style={{
            fontWeight: 700,
            color: isAttended ? '#FFF5E0' : '#1A0E05',
          }}
        >
          {part}
        </strong>
      )
    }
    return part
  })
}

export default function ThankYouScreen({ guest, inviteCode, variant, theme }: Props) {
  const [visible, setVisible] = useState(false)

  const activeTheme = resolveGuestThankYouTheme(guest, theme)
  const displayName = resolveGuestDisplayName(guest, undefined, variant)
  const { partnerInlineRef } = resolveGuestAndPartnerNames(guest)
  const copy = getThankYouCardCopy(variant, displayName, partnerInlineRef, activeTheme)
  const isAttended = variant === 'attended' || variant === 'attended_partner_missed'

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    if (guest?.id && !guest.id.startsWith('guest-')) {
      trackEvent(guest.id, inviteCode, `thankyou_${activeTheme}_${variant}_opened`)
      updateGuestInviteDetails(guest.id, {
        thank_you_status: 'seen',
        thank_you_type: variant,
        thank_you_theme: activeTheme,
      })
    }
    return () => clearTimeout(t)
  }, [guest?.id, inviteCode, variant, activeTheme])

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom select-none transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: isAttended
          ? 'radial-gradient(circle at 50% 25%, #2B1A11 0%, #140B07 65%, #0B0604 100%)'
          : 'radial-gradient(circle at 50% 25%, #FBF5EA 0%, #EFE1C6 65%, #E3CFAF 100%)',
      }}
    >
      {/* Luxury 4:5 Portrait Card Frame */}
      <div
        className="relative w-full max-w-[440px] aspect-[4/5] rounded-sm shadow-2xl overflow-hidden flex flex-col items-center justify-between text-center px-7 sm:px-10 py-9 sm:py-11"
        style={{
          background: isAttended
            ? 'linear-gradient(155deg, #1C110B 0%, #281810 48%, #120A06 100%)'
            : 'linear-gradient(155deg, #FBF6EE 0%, #F4E8D1 50%, #EAD8BA 100%)',
          boxShadow: isAttended
            ? '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(201, 168, 76, 0.12)'
            : '0 25px 60px rgba(90, 61, 34, 0.22), 0 0 40px rgba(218, 165, 75, 0.15)',
        }}
      >
        {/* Ambient golden glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isAttended
              ? 'radial-gradient(circle at 50% 26%, rgba(218, 176, 96, 0.18) 0%, transparent 60%), radial-gradient(circle at 50% 52%, rgba(232, 205, 145, 0.11) 0%, transparent 58%)'
              : 'radial-gradient(circle at 50% 22%, rgba(226, 174, 82, 0.20) 0%, transparent 58%), radial-gradient(circle at 50% 50%, rgba(255, 252, 245, 0.65) 0%, transparent 60%)',
          }}
        />

        {/* Double metallic border frame */}
        <div
          className="absolute inset-4 pointer-events-none"
          style={{
            border: isAttended
              ? '1px solid rgba(212, 175, 99, 0.42)'
              : '1px solid rgba(140, 102, 62, 0.34)',
          }}
        />
        <div
          className="absolute inset-[21px] pointer-events-none"
          style={{
            border: isAttended
              ? '1px solid rgba(212, 175, 99, 0.16)'
              : '1px solid rgba(140, 102, 62, 0.14)',
          }}
        />

        {/* Top Section: Diya Emblem + Intro + Event Title */}
        <div className="relative z-10 flex flex-col items-center w-full pt-1">
          <div
            className="flame-animate text-base sm:text-lg mb-2"
            style={{
              color: isAttended ? '#E0BA6E' : '#9B7040',
              filter: isAttended
                ? 'drop-shadow(0 0 10px rgba(232, 180, 90, 0.65))'
                : 'drop-shadow(0 0 8px rgba(218, 165, 75, 0.45))',
            }}
          >
            ◆
          </div>

          <p
            className="font-sans text-[8.5px] sm:text-[10px] tracking-[0.36em] uppercase mb-2 font-medium"
            style={{ color: isAttended ? '#D5B269' : '#7E5933' }}
          >
            {copy.topIntro}
          </p>

          <h1
            className={`font-cinzel font-semibold uppercase mb-1 ${
              copy.eventTitle.length > 14
                ? 'text-xl sm:text-2xl tracking-[0.11em]'
                : 'text-2xl sm:text-3xl tracking-[0.14em]'
            }`}
            style={{ color: isAttended ? '#F7EBD2' : '#3C2716' }}
          >
            {copy.eventTitle}
          </h1>

          <p
            className="font-sans text-[8.5px] sm:text-[10px] tracking-[0.26em] uppercase mb-4"
            style={{ color: isAttended ? '#C8A560' : '#7A5734' }}
          >
            {copy.eventSubtitle}
          </p>

          {/* Metallic Divider */}
          <div className="flex items-center justify-center w-44 gap-2">
            <div
              className="h-[1px] flex-1"
              style={{
                background: isAttended
                  ? 'linear-gradient(90deg, transparent, #D5B269)'
                  : 'linear-gradient(90deg, transparent, #8C653B)',
              }}
            />
            <span
              className="text-[8px]"
              style={{ color: isAttended ? '#D5B269' : '#8C653B' }}
            >
              ◆
            </span>
            <div
              className="h-[1px] flex-1"
              style={{
                background: isAttended
                  ? 'linear-gradient(90deg, #D5B269, transparent)'
                  : 'linear-gradient(90deg, #8C653B, transparent)',
              }}
            />
          </div>
        </div>

        {/* Center Section: Guest Name + Headline + Message */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-2 my-auto">
          <p
            className="font-sans text-[8.5px] sm:text-[10px] tracking-[0.42em] uppercase mb-1.5"
            style={{ color: isAttended ? 'rgba(235, 213, 171, 0.72)' : 'rgba(110, 78, 46, 0.78)' }}
          >
            {copy.salutation}
          </p>

          <h2
            className="font-serif font-semibold text-xl sm:text-2xl tracking-[0.08em] uppercase leading-snug mb-3"
            style={{ color: isAttended ? '#FFF5E0' : '#2E1C0E' }}
          >
            {copy.guestDisplayName}
          </h2>

          <div
            className="w-16 h-[1px] mb-4"
            style={{
              background: isAttended
                ? 'linear-gradient(90deg, transparent, rgba(213,178,105,0.6), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(140,101,59,0.5), transparent)',
            }}
          />

          <h3
            className={
              isAttended
                ? 'font-serif italic text-lg sm:text-xl mb-3 leading-snug'
                : 'font-cinzel font-medium text-base sm:text-lg tracking-[0.16em] uppercase mb-3 leading-snug'
            }
            style={{ color: isAttended ? '#EAC987' : '#5A3D22' }}
          >
            {copy.headline}
          </h3>

          <div className="flex flex-col gap-2 max-w-[310px]">
            {copy.bodyParagraphs.map((paragraph, i) => (
              <p
                key={i}
                className="font-sans text-xs sm:text-[13px] leading-relaxed"
                style={{ color: isAttended ? 'rgba(245, 236, 215, 0.88)' : '#4E3620' }}
              >
                {renderFormattedParagraph(paragraph, copy.partnerHighlight, isAttended)}
              </p>
            ))}
          </div>
        </div>

        {/* Bottom Section: Signature */}
        <div className="relative z-10 flex flex-col items-center w-full pb-1">
          <div className="flex items-center justify-center w-36 gap-2 mb-3">
            <div
              className="h-[1px] flex-1"
              style={{
                background: isAttended
                  ? 'linear-gradient(90deg, transparent, rgba(213,178,105,0.5))'
                  : 'linear-gradient(90deg, transparent, rgba(140,101,59,0.45))',
              }}
            />
            <span
              className="text-[7px]"
              style={{ color: isAttended ? '#D5B269' : '#8C653B' }}
            >
              ◆
            </span>
            <div
              className="h-[1px] flex-1"
              style={{
                background: isAttended
                  ? 'linear-gradient(90deg, rgba(213,178,105,0.5), transparent)'
                  : 'linear-gradient(90deg, rgba(140,101,59,0.45), transparent)',
              }}
            />
          </div>

          <p
            className="font-sans text-[8px] sm:text-[9px] tracking-[0.38em] uppercase mb-1"
            style={{ color: isAttended ? 'rgba(213, 178, 105, 0.78)' : 'rgba(126, 89, 51, 0.82)' }}
          >
            {copy.signOffLabel}
          </p>

          <p
            className="font-cinzel font-semibold text-xs sm:text-sm tracking-[0.16em] uppercase"
            style={{ color: isAttended ? '#F5E6C8' : '#3C2716' }}
          >
            {copy.signature}
          </p>
        </div>
      </div>
    </div>
  )
}
