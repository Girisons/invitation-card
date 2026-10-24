import { Guest, parseGuestNotes } from './supabase'

export type ThankYouVariant = 'attended' | 'missed'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350
export const SAFE_MARGIN = 96 // > 70px strict safe area requirement

export interface ThankYouCardCopy {
  variant: ThankYouVariant
  topIntro: string
  eventTitle: string
  eventSubtitle: string
  salutation: string
  guestDisplayName: string
  headline: string
  bodyParagraphs: string[]
  signOffLabel: string
  signature: string
}

/**
 * Resolves the exact personalised display name for a guest or couple/household
 * from the existing guest database records.
 */
export function resolveGuestDisplayName(guest: Guest, allGuests?: Guest[]): string {
  const notes = parseGuestNotes(guest.notes)
  if (notes.custom_card_name && notes.custom_card_name.trim()) {
    return notes.custom_card_name.trim()
  }

  const formatProper = (raw?: string) => {
    const cleaned = (raw || '').trim()
    if (!cleaned) return ''
    // Preserve multi-word names nicely while fixing ALL CAPS if needed
    return cleaned
      .split(/\s+/)
      .map(word => {
        if (word === '&' || word.toLowerCase() === 'and') return '&'
        if (word.length <= 2 && word === word.toUpperCase()) return word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
  }

  const primaryRaw = (guest.nickname && guest.nickname.trim())
    ? guest.nickname.trim()
    : (guest.first_name || '').trim()
  const primaryDisplay = formatProper(primaryRaw) || 'Honored Guest'

  let partnerRaw = ''
  if (guest.linked_guest_id && allGuests && allGuests.length > 0) {
    const linked = allGuests.find(other => other.id === guest.linked_guest_id)
    if (linked) {
      partnerRaw = (linked.nickname && linked.nickname.trim())
        ? linked.nickname.trim()
        : (linked.first_name || '').trim()
    }
  }

  if (!partnerRaw && guest.partner_name) {
    if (allGuests && allGuests.length > 0) {
      const matched = allGuests.find(other =>
        `${other.first_name}${other.last_name ? ' ' + other.last_name : ''}`.toLowerCase() === guest.partner_name?.toLowerCase() ||
        other.first_name.toLowerCase() === guest.partner_name?.toLowerCase() ||
        (other.nickname && other.nickname.toLowerCase() === guest.partner_name?.toLowerCase())
      )
      if (matched) {
        partnerRaw = (matched.nickname && matched.nickname.trim())
          ? matched.nickname.trim()
          : (matched.first_name || '').trim()
      } else {
        // Strip last name if partner_name has primary's surname
        partnerRaw = guest.partner_name.trim().split(' ')[0]
      }
    } else {
      partnerRaw = guest.partner_name.trim().split(' ')[0]
    }
  }

  const partnerDisplay = formatProper(partnerRaw)

  if (guest.send_together && partnerDisplay && !primaryDisplay.includes('&')) {
    return `${primaryDisplay} & ${partnerDisplay}`
  }

  return primaryDisplay
}

/**
 * Returns the exact locked copy for Card A (Attended) or Card B (Missed).
 */
export function getThankYouCardCopy(
  variant: ThankYouVariant,
  guestDisplayName: string
): ThankYouCardCopy {
  const cleanName = (guestDisplayName || 'Mansi & Roshan').trim().toUpperCase()

  if (variant === 'attended') {
    return {
      variant: 'attended',
      topIntro: 'A NIGHT TO REMEMBER',
      eventTitle: '40 & FESTIVE',
      eventSubtitle: "ARPIT'S 40TH BIRTHDAY & DIWALI BASH",
      salutation: 'DEAR',
      guestDisplayName: cleanName,
      headline: 'The night was better with you.',
      bodyParagraphs: [
        'Thank you for being part of our special evening and making it even more memorable with your presence.',
      ],
      signOffLabel: 'WITH LOVE,',
      signature: 'TANVI, ARPIT & FAMILY',
    }
  }

  return {
    variant: 'missed',
    topIntro: 'WITH WARMTH & AFFECTION',
    eventTitle: '40 & FESTIVE',
    eventSubtitle: "ARPIT'S 40TH BIRTHDAY & DIWALI BASH",
    salutation: 'DEAR',
    guestDisplayName: cleanName,
    headline: 'YOU WERE MISSED.',
    bodyParagraphs: [
      "Though we couldn't share the evening together, you were remembered with warmth and affection.",
      "Here's to making more beautiful memories together soon.",
    ],
    signOffLabel: 'WITH LOVE,',
    signature: 'TANVI, ARPIT & FAMILY',
  }
}

/**
 * Returns the exact WhatsApp message from Section 3 of the campaign brief.
 */
export function buildThankYouWhatsAppMessage(
  variant: ThankYouVariant,
  guestDisplayName: string,
  options?: { includeCardLink?: boolean; cardUrl?: string }
): string {
  const cleanName = (guestDisplayName || 'Mansi & Roshan').trim()
  const heart = String.fromCodePoint(0x2764, 0xFE0F)
  const sparkles = String.fromCodePoint(0x2728)

  let msg = ''
  if (variant === 'attended') {
    msg = `Dear ${cleanName} ${heart}\n\nThank you for being part of Arpit's 40 & FESTIVE. Your presence made the evening even more special, and we're so glad we could share these wonderful moments with you.\n\nA little note of gratitude, sent with lots of love. ${sparkles}\n\nTanvi, Arpit & Family`
  } else {
    msg = `Dear ${cleanName} ${heart}\n\nWe missed having you with us at Arpit's 40 & FESTIVE. You were remembered with lots of warmth, and we hope we get to share another special moment together soon.\n\nSending you all our love and warm wishes. ${sparkles}\n\nTanvi, Arpit & Family`
  }

  if (options?.includeCardLink && options?.cardUrl) {
    msg += `\n\n${sparkles} Your Personalised Note:\n${options.cardUrl}`
  }

  return msg
}

/**
 * Standardised file naming convention per production specs:
 * `thankyou_ATTENDED_guestid.png` and `thankyou_MISSED_guestid.png`
 */
export function getThankYouCardFilename(variant: ThankYouVariant, guestIdOrCode: string): string {
  const safeId = (guestIdOrCode || 'guest').replace(/[^a-zA-Z0-9_-]/g, '')
  const prefix = variant === 'attended' ? 'thankyou_ATTENDED' : 'thankyou_MISSED'
  return `${prefix}_${safeId}.png`
}

/**
 * Word-wrapping helper for HTML5 Canvas text rendering within safe margins.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Draws spaced uppercase tracking text centered at (x, y).
 */
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number
) {
  const chars = Array.from(text)
  if (chars.length === 0) return
  const widths = chars.map(c => ctx.measureText(c).width)
  const totalWidth = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1)
  let currentX = x - totalWidth / 2
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], currentX, y)
    currentX += widths[i] + letterSpacing
  }
  ctx.textAlign = prevAlign
}

/**
 * Draws a subtle restrained diya / warm light emblem at (cx, cy).
 */
function drawDiyaEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  glowColor: string,
  scale = 1
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)

  // Soft radial glow behind flame
  const glow = ctx.createRadialGradient(0, -4, 1, 0, -4, 34)
  glow.addColorStop(0, glowColor)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, -4, 34, 0, Math.PI * 2)
  ctx.fill()

  // Outer flame teardrop
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.bezierCurveTo(7, -8, 7, 1, 0, 6)
  ctx.bezierCurveTo(-7, 1, -7, -8, 0, -18)
  ctx.closePath()
  ctx.fill()

  // Inner bright core
  ctx.fillStyle = '#FFF6DF'
  ctx.globalAlpha = 0.75
  ctx.beginPath()
  ctx.moveTo(0, -11)
  ctx.bezierCurveTo(3.2, -5, 3.2, 0, 0, 3.5)
  ctx.bezierCurveTo(-3.2, 0, -3.2, -5, 0, -11)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  // Minimalist crescent diya base
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 6, 13, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()

  ctx.restore()
}

/**
 * Draws a fine metallic divider line with a central diamond accent.
 */
function drawMetallicDivider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  halfWidth: number,
  primaryHex: string,
  rgbaEdge: string,
  withDiamond = true
) {
  ctx.save()
  const grad = ctx.createLinearGradient(cx - halfWidth, y, cx + halfWidth, y)
  grad.addColorStop(0, rgbaEdge)
  grad.addColorStop(0.25, primaryHex)
  grad.addColorStop(0.5, primaryHex)
  grad.addColorStop(0.75, primaryHex)
  grad.addColorStop(1, rgbaEdge)

  ctx.strokeStyle = grad
  ctx.lineWidth = 1.25
  ctx.beginPath()
  if (withDiamond) {
    ctx.moveTo(cx - halfWidth, y)
    ctx.lineTo(cx - 14, y)
    ctx.moveTo(cx + 14, y)
    ctx.lineTo(cx + halfWidth, y)
  } else {
    ctx.moveTo(cx - halfWidth, y)
    ctx.lineTo(cx + halfWidth, y)
  }
  ctx.stroke()

  if (withDiamond) {
    ctx.fillStyle = primaryHex
    ctx.beginPath()
    ctx.moveTo(cx, y - 4.5)
    ctx.lineTo(cx + 4.5, y)
    ctx.lineTo(cx, y + 4.5)
    ctx.lineTo(cx - 4.5, y)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Renders the 1080 × 1350 px (Portrait 4:5) Luxury Thank-You Card onto an HTML5 Canvas.
 * Uses real typography on top of a bespoke procedural luxury background.
 */
export async function renderThankYouCardToCanvas(
  canvas: HTMLCanvasElement,
  variant: ThankYouVariant,
  guestDisplayName: string
): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready
    } catch {}
  }

  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const copy = getThankYouCardCopy(variant, guestDisplayName)
  const cx = CARD_WIDTH / 2
  const maxContentWidth = CARD_WIDTH - SAFE_MARGIN * 2 // 888px safe width

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const isAttended = variant === 'attended'

  // ── 1. LUXURY BACKGROUND & ATMOSPHERIC GLOW ──
  if (isAttended) {
    // Card A: Dark Walnut & Antique Bronze Edition
    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.3, CARD_HEIGHT)
    bgGrad.addColorStop(0, '#1C110B')
    bgGrad.addColorStop(0.45, '#271810')
    bgGrad.addColorStop(1, '#120A06')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    // Restrained halo of warm golden light around the title & guest name
    const topHalo = ctx.createRadialGradient(cx, 330, 20, cx, 330, 460)
    topHalo.addColorStop(0, 'rgba(218, 176, 96, 0.19)')
    topHalo.addColorStop(0.55, 'rgba(176, 126, 56, 0.07)')
    topHalo.addColorStop(1, 'rgba(18, 10, 6, 0)')
    ctx.fillStyle = topHalo
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    const centerHalo = ctx.createRadialGradient(cx, 660, 10, cx, 660, 480)
    centerHalo.addColorStop(0, 'rgba(232, 205, 145, 0.13)')
    centerHalo.addColorStop(0.6, 'rgba(184, 134, 65, 0.04)')
    centerHalo.addColorStop(1, 'rgba(18, 10, 6, 0)')
    ctx.fillStyle = centerHalo
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    // Subtle vignette around edges for depth
    const vignette = ctx.createRadialGradient(cx, CARD_HEIGHT / 2, 380, cx, CARD_HEIGHT / 2, 860)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(5, 2, 1, 0.55)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  } else {
    // Card B: Warm Ivory & Soft Champagne Edition
    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.25, CARD_HEIGHT)
    bgGrad.addColorStop(0, '#FBF6EE')
    bgGrad.addColorStop(0.5, '#F4E8D1')
    bgGrad.addColorStop(1, '#EAD8BA')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    // Single subtle diya-inspired golden glow in upper-center
    const diyaGlow = ctx.createRadialGradient(cx, 250, 10, cx, 250, 420)
    diyaGlow.addColorStop(0, 'rgba(226, 174, 82, 0.22)')
    diyaGlow.addColorStop(0.5, 'rgba(210, 160, 75, 0.08)')
    diyaGlow.addColorStop(1, 'rgba(244, 232, 209, 0)')
    ctx.fillStyle = diyaGlow
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    // Soft warm ivory luminance behind guest name
    const centerLight = ctx.createRadialGradient(cx, 640, 20, cx, 640, 450)
    centerLight.addColorStop(0, 'rgba(255, 252, 245, 0.65)')
    centerLight.addColorStop(1, 'rgba(255, 252, 245, 0)')
    ctx.fillStyle = centerLight
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  }

  // ── 2. SUBTLE EDITORIAL BORDER & CORNER ACCENTS (Inside Safe Area) ──
  const outerPad = 56
  const innerPad = 68
  const borderPrimary = isAttended ? 'rgba(209, 173, 102, 0.42)' : 'rgba(140, 102, 62, 0.34)'
  const borderSecondary = isAttended ? 'rgba(209, 173, 102, 0.16)' : 'rgba(140, 102, 62, 0.14)'

  ctx.save()
  ctx.strokeStyle = borderPrimary
  ctx.lineWidth = 1.5
  ctx.strokeRect(outerPad, outerPad, CARD_WIDTH - outerPad * 2, CARD_HEIGHT - outerPad * 2)

  ctx.strokeStyle = borderSecondary
  ctx.lineWidth = 1
  ctx.strokeRect(innerPad, innerPad, CARD_WIDTH - innerPad * 2, CARD_HEIGHT - innerPad * 2)

  // Corner L-ornaments
  const cornerLen = 22
  const corners = [
    [outerPad - 6, outerPad - 6, 1, 1],
    [CARD_WIDTH - outerPad + 6, outerPad - 6, -1, 1],
    [outerPad - 6, CARD_HEIGHT - outerPad + 6, 1, -1],
    [CARD_WIDTH - outerPad + 6, CARD_HEIGHT - outerPad + 6, -1, -1],
  ]
  ctx.strokeStyle = isAttended ? '#D4AF63' : '#8C663E'
  ctx.lineWidth = 1.5
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(x, y + dy * cornerLen)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * cornerLen, y)
    ctx.stroke()
  }
  ctx.restore()

  // ── 3. PALETTE TOKENS FOR TYPOGRAPHY ──
  const goldAccent = isAttended ? '#D5B269' : '#8C653B'
  const goldEdge = isAttended ? 'rgba(213, 178, 105, 0)' : 'rgba(140, 101, 59, 0)'
  const introColor = isAttended ? '#D5B269' : '#7E5933'
  const titleColor = isAttended ? '#F7EBD2' : '#3C2716'
  const subtitleColor = isAttended ? '#C8A560' : '#7A5734'
  const dearColor = isAttended ? 'rgba(235, 213, 171, 0.72)' : 'rgba(110, 78, 46, 0.78)'
  const nameColor = isAttended ? '#FFF5E0' : '#2E1C0E'
  const headlineColor = isAttended ? '#EAC987' : '#5A3D22'
  const bodyColor = isAttended ? 'rgba(245, 236, 215, 0.88)' : '#4E3620'
  const signOffColor = isAttended ? 'rgba(213, 178, 105, 0.78)' : 'rgba(126, 89, 51, 0.82)'
  const signatureColor = isAttended ? '#F5E6C8' : '#3C2716'

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // ── 4. TOP DIYA EMBLEM & INTRODUCTORY LINE ──
  drawDiyaEmblem(
    ctx,
    cx,
    148,
    isAttended ? '#E0BA6E' : '#9B7040',
    isAttended ? 'rgba(232, 180, 90, 0.35)' : 'rgba(218, 165, 75, 0.32)',
    1.05
  )

  // 1. Small elegant introductory line at the top
  ctx.font = '500 17px Inter, system-ui, sans-serif'
  ctx.fillStyle = introColor
  drawTrackedText(ctx, copy.topIntro, cx, 212, 7.5)

  // 2. Event title: "40 & FESTIVE"
  ctx.font = '600 66px Cinzel, Georgia, serif'
  ctx.fillStyle = titleColor
  drawTrackedText(ctx, copy.eventTitle, cx, 290, 6)

  // 3. Subtitle: "ARPIT'S 40TH BIRTHDAY & DIWALI BASH"
  ctx.font = '500 18px Inter, system-ui, sans-serif'
  ctx.fillStyle = subtitleColor
  drawTrackedText(ctx, copy.eventSubtitle, cx, 352, 5.5)

  // Upper Metallic Divider
  drawMetallicDivider(ctx, cx, 412, 240, goldAccent, goldEdge, true)

  // ── 5. SALUTATION & GUEST DISPLAY NAME (HERO FOCAL POINT) ──
  ctx.font = '500 16px Inter, system-ui, sans-serif'
  ctx.fillStyle = dearColor
  drawTrackedText(ctx, copy.salutation, cx, 488, 8)

  // Dynamic font sizing & wrapping for Guest Display Name so long names/couples/families fit with poise
  const nameUpper = copy.guestDisplayName
  let nameFontSize = 62
  if (nameUpper.length > 26) nameFontSize = 42
  else if (nameUpper.length > 20) nameFontSize = 48
  else if (nameUpper.length > 15) nameFontSize = 54

  ctx.font = `600 ${nameFontSize}px "Playfair Display", Cinzel, Georgia, serif`
  ctx.fillStyle = nameColor

  const nameLines = wrapCanvasText(ctx, nameUpper, maxContentWidth - 40)
  const nameLineHeight = nameFontSize * 1.22
  const nameBlockCenterY = nameLines.length > 1 ? 574 : 566
  const nameStartY = nameBlockCenterY - ((nameLines.length - 1) * nameLineHeight) / 2

  nameLines.forEach((line, idx) => {
    drawTrackedText(ctx, line, cx, nameStartY + idx * nameLineHeight, 3.5)
  })

  // Delicate short divider under guest name
  const postNameY = nameStartY + (nameLines.length - 1) * nameLineHeight + 66
  drawMetallicDivider(ctx, cx, postNameY, 110, goldAccent, goldEdge, false)

  // ── 6. EMOTIONALLY RESONANT HEADLINE ──
  const headlineY = postNameY + 86
  if (isAttended) {
    // "The night was better with you." — Editorial serif
    ctx.font = 'italic 500 46px "Playfair Display", Georgia, serif'
    ctx.fillStyle = headlineColor
    ctx.fillText(copy.headline, cx, headlineY)
  } else {
    // "YOU WERE MISSED." — Refined tracked serif
    ctx.font = '500 40px Cinzel, "Playfair Display", Georgia, serif'
    ctx.fillStyle = headlineColor
    drawTrackedText(ctx, copy.headline, cx, headlineY, 5.5)
  }

  // ── 7. SHORT, READABLE THANK-YOU MESSAGE ──
  ctx.font = '400 26px Inter, system-ui, sans-serif'
  ctx.fillStyle = bodyColor
  const bodyMaxWidth = 740
  const bodyLineHeight = 42
  let currentBodyY = headlineY + 82

  for (let p = 0; p < copy.bodyParagraphs.length; p++) {
    const lines = wrapCanvasText(ctx, copy.bodyParagraphs[p], bodyMaxWidth)
    for (const line of lines) {
      ctx.fillText(line, cx, currentBodyY)
      currentBodyY += bodyLineHeight
    }
    if (p < copy.bodyParagraphs.length - 1) {
      currentBodyY += 22 // Paragraph spacing
    }
  }

  // Lower Metallic Divider
  drawMetallicDivider(ctx, cx, 1068, 190, goldAccent, goldEdge, true)

  // ── 8. SIGNATURE BLOCK ──
  ctx.font = '500 16px Inter, system-ui, sans-serif'
  ctx.fillStyle = signOffColor
  drawTrackedText(ctx, copy.signOffLabel, cx, 1138, 7)

  ctx.font = '600 28px Cinzel, "Playfair Display", Georgia, serif'
  ctx.fillStyle = signatureColor
  drawTrackedText(ctx, copy.signature, cx, 1192, 4.5)
}
