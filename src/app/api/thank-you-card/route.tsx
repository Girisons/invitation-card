import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getGuestByCode, parseGuestNotes } from '@/lib/supabase'
import { getThankYouCardCopy, resolveGuestDisplayName, ThankYouVariant } from '@/lib/thankYouCard'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawCode = (searchParams.get('code') || '').trim().toUpperCase()
  const rawName = (searchParams.get('name') || '').trim()
  const rawType = (searchParams.get('type') || '').trim().toLowerCase()

  let displayName = rawName
  let resolvedVariant: ThankYouVariant = rawType === 'missed' || rawType === 'did_not_attend' ? 'missed' : 'attended'

  if (rawCode && !displayName) {
    try {
      const guest = await getGuestByCode(rawCode)
      if (guest) {
        displayName = resolveGuestDisplayName(guest)
        const notes = parseGuestNotes(guest.notes)
        if (!rawType) {
          if (notes.thank_you_type === 'missed' || notes.attendance_status === 'did_not_attend') {
            resolvedVariant = 'missed'
          } else {
            resolvedVariant = 'attended'
          }
        }
      }
    } catch {
      // fallback
    }
  }

  if (!displayName) {
    displayName = 'Mansi & Roshan'
  }

  const copy = getThankYouCardCopy(resolvedVariant, displayName)
  const isAttended = resolvedVariant === 'attended'

  const bgGradient = isAttended
    ? 'linear-gradient(155deg, #1C110B 0%, #281810 48%, #120A06 100%)'
    : 'linear-gradient(155deg, #FBF6EE 0%, #F4E8D1 50%, #EAD8BA 100%)'

  const borderOuter = isAttended ? 'rgba(212, 175, 99, 0.42)' : 'rgba(140, 102, 62, 0.34)'
  const borderInner = isAttended ? 'rgba(212, 175, 99, 0.18)' : 'rgba(140, 102, 62, 0.15)'
  const introColor = isAttended ? '#D5B269' : '#7E5933'
  const titleColor = isAttended ? '#F7EBD2' : '#3C2716'
  const subtitleColor = isAttended ? '#C8A560' : '#7A5734'
  const dearColor = isAttended ? 'rgba(235, 213, 171, 0.75)' : 'rgba(110, 78, 46, 0.78)'
  const nameColor = isAttended ? '#FFF5E0' : '#2E1C0E'
  const headlineColor = isAttended ? '#EAC987' : '#5A3D22'
  const bodyColor = isAttended ? 'rgba(245, 236, 215, 0.9)' : '#4E3620'
  const signOffColor = isAttended ? 'rgba(213, 178, 105, 0.78)' : 'rgba(126, 89, 51, 0.82)'
  const signatureColor = isAttended ? '#F5E6C8' : '#3C2716'
  const dividerColor = isAttended ? 'rgba(213, 178, 105, 0.45)' : 'rgba(140, 101, 59, 0.38)'

  const nameLength = copy.guestDisplayName.length
  const nameFontSize = nameLength > 26 ? 42 : nameLength > 20 ? 48 : nameLength > 15 ? 54 : 60

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1350px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: bgGradient,
          padding: '110px 104px',
          position: 'relative',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Outer Luxury Frame */}
        <div
          style={{
            position: 'absolute',
            top: '56px',
            left: '56px',
            right: '56px',
            bottom: '56px',
            border: `1.5px solid ${borderOuter}`,
            display: 'flex',
          }}
        />
        {/* Inner Hairline Frame */}
        <div
          style={{
            position: 'absolute',
            top: '68px',
            left: '68px',
            right: '68px',
            bottom: '68px',
            border: `1px solid ${borderInner}`,
            display: 'flex',
          }}
        />

        {/* Top Header Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
          }}
        >
          {/* Diya Flame Diamond */}
          <div
            style={{
              fontSize: '26px',
              color: introColor,
              marginBottom: '22px',
              display: 'flex',
            }}
          >
            ◆
          </div>

          {/* 1. Small elegant introductory line */}
          <div
            style={{
              fontSize: '17px',
              letterSpacing: '0.38em',
              color: introColor,
              textTransform: 'uppercase',
              marginBottom: '26px',
              fontFamily: 'sans-serif',
            }}
          >
            {copy.topIntro}
          </div>

          {/* 2. Event Title */}
          <div
            style={{
              fontSize: '64px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: titleColor,
              marginBottom: '16px',
            }}
          >
            {copy.eventTitle}
          </div>

          {/* 3. Subtitle */}
          <div
            style={{
              fontSize: '18px',
              letterSpacing: '0.28em',
              color: subtitleColor,
              textTransform: 'uppercase',
              marginBottom: '44px',
              fontFamily: 'sans-serif',
            }}
          >
            {copy.eventSubtitle}
          </div>

          {/* Divider */}
          <div
            style={{
              width: '360px',
              height: '1.5px',
              background: dividerColor,
              display: 'flex',
            }}
          />
        </div>

        {/* Center Personalised Hero Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              letterSpacing: '0.45em',
              color: dearColor,
              textTransform: 'uppercase',
              marginBottom: '22px',
              fontFamily: 'sans-serif',
            }}
          >
            {copy.salutation}
          </div>

          {/* 4. Guest Name */}
          <div
            style={{
              fontSize: `${nameFontSize}px`,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: nameColor,
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '36px',
            }}
          >
            {copy.guestDisplayName}
          </div>

          {/* Short Center Divider */}
          <div
            style={{
              width: '160px',
              height: '1px',
              background: dividerColor,
              marginBottom: '44px',
              display: 'flex',
            }}
          />

          {/* 5. Emotionally Resonant Headline */}
          <div
            style={{
              fontSize: isAttended ? '44px' : '38px',
              fontStyle: isAttended ? 'italic' : 'normal',
              letterSpacing: isAttended ? '0.02em' : '0.16em',
              color: headlineColor,
              marginBottom: '36px',
              textAlign: 'center',
            }}
          >
            {copy.headline}
          </div>

          {/* 6. Short Readable Thank-You Message */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              maxWidth: '720px',
            }}
          >
            {copy.bodyParagraphs.map((p, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '26px',
                  lineHeight: 1.6,
                  color: bodyColor,
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                }}
              >
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Signature Block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              width: '280px',
              height: '1.5px',
              background: dividerColor,
              marginBottom: '42px',
              display: 'flex',
            }}
          />

          <div
            style={{
              fontSize: '16px',
              letterSpacing: '0.4em',
              color: signOffColor,
              textTransform: 'uppercase',
              marginBottom: '16px',
              fontFamily: 'sans-serif',
            }}
          >
            {copy.signOffLabel}
          </div>

          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '0.16em',
              color: signatureColor,
              textTransform: 'uppercase',
            }}
          >
            {copy.signature}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
    }
  )
}
