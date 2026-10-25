import { Guest, parseGuestNotes } from './supabase'

export type ThankYouVariant =
  | 'attended'
  | 'missed'
  | 'attended_partner_missed'
  | 'missed_partner_attended'

export type ThankYouTheme = '40_festive' | 'soiree'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350
export const SAFE_MARGIN = 96 // > 70px strict safe area requirement

export interface ThankYouCardCopy {
  variant: ThankYouVariant
  theme: ThankYouTheme
  topIntro: string
  eventTitle: string
  eventSubtitle: string
  salutation: string
  guestDisplayName: string
  headline: string
  bodyParagraphs: string[]
  partnerHighlight?: string
  signOffLabel: string
  signature: string
}

/**
 * Resolves whether a guest should receive the '40_festive' ("40 & FESTIVE") or
 * 'soiree' ("THE FESTIVE SOIRÉE") Thank-You Card based on explicit override,
 * saved guest notes, or host assignment (Vipul / Jitu default to 'soiree').
 */
export function resolveGuestThankYouTheme(
  guest?: Guest | null,
  explicitTheme?: string | null
): ThankYouTheme {
  const cleanExplicit = (explicitTheme || '').trim().toLowerCase()
  if (
    cleanExplicit === 'soiree' ||
    cleanExplicit === 'diwali' ||
    cleanExplicit.includes('soiree') ||
    cleanExplicit.includes('diwali')
  ) {
    return 'soiree'
  }
  if (cleanExplicit === '40_festive' || cleanExplicit === '40' || cleanExplicit === '40andfestive') {
    return '40_festive'
  }

  if (guest) {
    const notes = parseGuestNotes(guest.notes)
    if (notes.thank_you_theme === 'soiree') return 'soiree'
    if (notes.thank_you_theme === '40_festive') return '40_festive'
    if (
      notes.insta_type === 'soiree' ||
      notes.main_type === 'diwali' ||
      notes.std_type === 'diwali'
    ) {
      return 'soiree'
    }
    if (
      notes.insta_type === '40_festive' ||
      notes.main_type === '40_festive' ||
      notes.std_type === '40_festive'
    ) {
      return '40_festive'
    }
    const host = (guest.guest_of || '').toLowerCase().trim()
    if (host === 'vipul' || host === 'jitu') {
      return 'soiree'
    }
  }

  return '40_festive'
}

function stripHonorifics(raw?: string): string {
  return (raw || '')
    .replace(/\b(mr|mrs|ms|miss|shri|smt)\.?\s+/gi, '')
    .replace(/^(mr|mrs|ms|miss|shri|smt)\.?$/gi, '')
    .trim()
}

function formatProperName(raw?: string): string {
  const cleaned = stripHonorifics(raw)
  if (!cleaned) return ''
  return cleaned
    .split(/\s+/)
    .map(word => {
      if (word === '&' || word.toLowerCase() === 'and') return '&'
      if (word.length <= 2 && word === word.toUpperCase()) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function isPlaceholderPartnerLabel(raw?: string): boolean {
  const upper = (raw || '').trim().toUpperCase()
  return (
    upper === 'YOUR WIFE' ||
    upper === 'WIFE' ||
    upper === 'YOUR HUSBAND' ||
    upper === 'HUSBAND' ||
    upper === 'YOUR PARTNER' ||
    upper === 'PARTNER' ||
    upper === 'SPOUSE'
  )
}

/**
 * Resolves individual guest name, partner name, inline partner reference for mid-sentence copy,
 * and combined couple display name.
 * Gracefully handles DB rows where `first_name` or `partner_name` is "YOUR WIFE".
 */
export function resolveGuestAndPartnerNames(
  guest: Guest,
  allGuests?: Guest[]
): {
  individualName: string
  partnerName: string
  partnerInlineRef: string
  coupleName: string
} {
  const primaryRaw =
    guest.nickname && guest.nickname.trim()
      ? guest.nickname.trim()
      : (guest.first_name || '').trim()

  let partnerRaw = ''
  if (guest.linked_guest_id && allGuests && allGuests.length > 0) {
    const linked = allGuests.find(other => other.id === guest.linked_guest_id)
    if (linked) {
      partnerRaw =
        linked.nickname && linked.nickname.trim()
          ? linked.nickname.trim()
          : (linked.first_name || '').trim()
    }
  }

  if (!partnerRaw && guest.partner_name) {
    if (allGuests && allGuests.length > 0) {
      const matched = allGuests.find(
        other =>
          `${other.first_name}${other.last_name ? ' ' + other.last_name : ''}`.toLowerCase() ===
            guest.partner_name?.toLowerCase() ||
          other.first_name.toLowerCase() === guest.partner_name?.toLowerCase() ||
          (other.nickname && other.nickname.toLowerCase() === guest.partner_name?.toLowerCase())
      )
      if (matched) {
        partnerRaw =
          matched.nickname && matched.nickname.trim()
            ? matched.nickname.trim()
            : (matched.first_name || '').trim()
      } else {
        partnerRaw = isPlaceholderPartnerLabel(guest.partner_name)
          ? guest.partner_name.trim()
          : guest.partner_name.trim().split(' ')[0]
      }
    } else {
      partnerRaw = isPlaceholderPartnerLabel(guest.partner_name)
        ? guest.partner_name.trim()
        : guest.partner_name.trim().split(' ')[0]
    }
  }

  const primaryIsPlaceholder = isPlaceholderPartnerLabel(primaryRaw)
  const partnerIsPlaceholder = isPlaceholderPartnerLabel(partnerRaw)

  const formattedPartner = partnerIsPlaceholder ? '' : formatProperName(partnerRaw)
  let individualName = primaryIsPlaceholder ? '' : formatProperName(primaryRaw)

  // If this guest row is a placeholder like "YOUR WIFE" and partner is e.g. "Anirudh",
  // use the real partner name directly (never "Mrs. Anirudh").
  if (!individualName && formattedPartner) {
    individualName = formattedPartner
  }
  if (!individualName) {
    individualName = 'Honored Guest'
  }

  // Inline partner reference for sentences like "We missed having [partnerInlineRef] with us"
  let partnerInlineRef = 'your partner'
  if (partnerRaw.trim()) {
    const upperPart = partnerRaw.trim().toUpperCase()
    if (upperPart === 'YOUR WIFE' || upperPart === 'WIFE') {
      partnerInlineRef = 'your wife'
    } else if (upperPart === 'YOUR HUSBAND' || upperPart === 'HUSBAND') {
      partnerInlineRef = 'your husband'
    } else if (partnerIsPlaceholder) {
      partnerInlineRef = 'your partner'
    } else if (primaryIsPlaceholder) {
      const upperPri = primaryRaw.trim().toUpperCase()
      partnerInlineRef = upperPri.includes('WIFE')
        ? 'your wife'
        : upperPri.includes('HUSBAND')
        ? 'your husband'
        : 'your partner'
    } else {
      partnerInlineRef = formattedPartner
    }
  }

  const coupleName =
    guest.send_together &&
    formattedPartner &&
    !primaryIsPlaceholder &&
    !partnerIsPlaceholder &&
    individualName.toLowerCase() !== formattedPartner.toLowerCase() &&
    !individualName.includes('&')
      ? `${individualName} & ${formattedPartner}`
      : individualName

  return {
    individualName,
    partnerName: formattedPartner,
    partnerInlineRef,
    coupleName,
  }
}

/**
 * Resolves the exact personalised display name for a guest or couple/household
 * from the existing guest database records.
 * For split couple attendance (`attended_partner_missed` or `missed_partner_attended`),
 * addresses the specific individual rather than both names together.
 */
export function resolveGuestDisplayName(
  guest: Guest,
  allGuests?: Guest[],
  variant?: ThankYouVariant
): string {
  const notes = parseGuestNotes(guest.notes)
  if (notes.custom_card_name && notes.custom_card_name.trim()) {
    return stripHonorifics(notes.custom_card_name.trim())
  }

  const { individualName, coupleName } = resolveGuestAndPartnerNames(guest, allGuests)

  if (variant === 'attended_partner_missed' || variant === 'missed_partner_attended') {
    return individualName
  }

  return coupleName
}

/**
 * Helper to split a combined name like "Mansi & Roshan" into primary + partner
 * when previewing split-partner cards in the Studio without a separate partner prop.
 */
function resolveSplitNamesFromDisplay(
  guestDisplayName: string,
  variant: ThankYouVariant,
  explicitPartnerRef?: string
): { addresseeName: string; partnerRef: string } {
  const raw = (guestDisplayName || 'Mansi & Roshan').trim()
  if (explicitPartnerRef && explicitPartnerRef.trim()) {
    const addr = raw.includes('&') ? raw.split('&')[0].trim() : raw
    return { addresseeName: addr, partnerRef: explicitPartnerRef.trim() }
  }

  if (raw.includes('&')) {
    const parts = raw.split('&').map(s => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      if (variant === 'attended_partner_missed') {
        return { addresseeName: parts[0], partnerRef: formatProperName(parts[1]) }
      }
      if (variant === 'missed_partner_attended') {
        return { addresseeName: parts[1], partnerRef: formatProperName(parts[0]) }
      }
    }
  }

  return {
    addresseeName: raw,
    partnerRef: 'your partner',
  }
}

/**
 * Returns the exact locked copy for:
 * - Card A (`attended`): Both / Guest Attended
 * - Card B (`missed`): Both / Guest Could Not Attend
 * - Card C (`attended_partner_missed`): Guest Attended, Partner Could Not Attend
 * - Card D (`missed_partner_attended`): Guest Could Not Attend, Partner Attended
 * Supports both '40_festive' ("40 & FESTIVE") and 'soiree' ("THE FESTIVE SOIRÉE").
 */
export function getThankYouCardCopy(
  variant: ThankYouVariant,
  guestDisplayName: string,
  partnerInlineRef?: string,
  theme: ThankYouTheme = '40_festive'
): ThankYouCardCopy {
  const cleanName = stripHonorifics(guestDisplayName || 'Mansi & Roshan').toUpperCase()
  const isSoiree = theme === 'soiree'
  const eventTitle = isSoiree ? 'THE FESTIVE SOIRÉE' : '40 & FESTIVE'
  const eventSubtitle = isSoiree
    ? 'KHANDELWAL DIWALI CELEBRATION'
    : "ARPIT'S 40TH BIRTHDAY & DIWALI BASH"
  const signature = isSoiree ? 'KHANDELWAL FAMILY' : 'TANVI, ARPIT & FAMILY'

  if (variant === 'attended') {
    return {
      variant: 'attended',
      theme,
      topIntro: 'A NIGHT TO REMEMBER',
      eventTitle,
      eventSubtitle,
      salutation: 'DEAR',
      guestDisplayName: cleanName,
      headline: 'The night was better with you.',
      bodyParagraphs: [
        'Thank you for being part of our special evening and making it even more memorable with your presence.',
      ],
      signOffLabel: 'WITH LOVE,',
      signature,
    }
  }

  if (variant === 'attended_partner_missed') {
    const { addresseeName, partnerRef } = resolveSplitNamesFromDisplay(
      guestDisplayName,
      variant,
      partnerInlineRef
    )
    return {
      variant: 'attended_partner_missed',
      theme,
      topIntro: 'A NIGHT TO REMEMBER',
      eventTitle,
      eventSubtitle,
      salutation: 'DEAR',
      guestDisplayName: addresseeName.toUpperCase(),
      headline: 'The night was better with you.',
      bodyParagraphs: [
        'Thank you for being part of our special evening and making it so memorable with your presence.',
        `We truly missed having ${partnerRef} with us, and look forward to celebrating with you both soon.`,
      ],
      partnerHighlight: partnerRef,
      signOffLabel: 'WITH LOVE,',
      signature,
    }
  }

  if (variant === 'missed_partner_attended') {
    const { addresseeName, partnerRef } = resolveSplitNamesFromDisplay(
      guestDisplayName,
      variant,
      partnerInlineRef
    )
    return {
      variant: 'missed_partner_attended',
      theme,
      topIntro: 'WITH WARMTH & AFFECTION',
      eventTitle,
      eventSubtitle,
      salutation: 'DEAR',
      guestDisplayName: addresseeName.toUpperCase(),
      headline: 'YOU WERE MISSED.',
      bodyParagraphs: [
        `We missed having you with us this evening, though it was so wonderful having ${partnerRef} celebrate with us.`,
        "Here's to making more beautiful memories together with you both soon.",
      ],
      partnerHighlight: partnerRef,
      signOffLabel: 'WITH LOVE,',
      signature,
    }
  }

  return {
    variant: 'missed',
    theme,
    topIntro: 'WITH WARMTH & AFFECTION',
    eventTitle,
    eventSubtitle,
    salutation: 'DEAR',
    guestDisplayName: cleanName,
    headline: 'YOU WERE MISSED.',
    bodyParagraphs: [
      "Though we couldn't share the evening together, you were remembered with warmth and affection.",
      "Here's to making more beautiful memories together soon.",
    ],
    signOffLabel: 'WITH LOVE,',
    signature,
  }
}

/**
 * Returns the exact WhatsApp message for all 4 thank-you scenarios across both themes.
 */
export function buildThankYouWhatsAppMessage(
  variant: ThankYouVariant,
  guestDisplayName: string,
  options?: {
    includeCardLink?: boolean
    cardUrl?: string
    partnerName?: string
    theme?: ThankYouTheme
  }
): string {
  const cleanName = (guestDisplayName || 'Mansi & Roshan').trim()
  const heart = String.fromCodePoint(0x2764, 0xFE0F)
  const sparkles = String.fromCodePoint(0x2728)
  const loveLetter = String.fromCodePoint(0x1F48C)
  const isSoiree = options?.theme === 'soiree'
  const eventLabel = isSoiree ? 'The Festive Soirée' : "Arpit's 40 & FESTIVE"
  const signOff = isSoiree ? 'Khandelwal Family' : 'Tanvi, Arpit & Family'

  let msg = ''
  if (variant === 'attended') {
    msg = `Dear ${cleanName} ${heart}\n\nThank you for being part of ${eventLabel}. Your presence made the evening even more special, and we're so glad we could share these wonderful moments with you.\n\nA little note of gratitude, sent with lots of love. ${sparkles}\n\n${signOff}`
  } else if (variant === 'attended_partner_missed') {
    const { addresseeName, partnerRef } = resolveSplitNamesFromDisplay(
      cleanName,
      variant,
      options?.partnerName
    )
    msg = `Dear ${addresseeName} ${heart}\n\nThank you for being part of ${eventLabel}. Your presence made the evening so special, though we truly missed having *${partnerRef}* with us!\n\nSending our warmest love to you both, and hoping we celebrate together very soon. ${sparkles}\n\n${signOff}`
  } else if (variant === 'missed_partner_attended') {
    const { addresseeName, partnerRef } = resolveSplitNamesFromDisplay(
      cleanName,
      variant,
      options?.partnerName
    )
    msg = `Dear ${addresseeName} ${heart}\n\nWe missed having you with us at ${eventLabel}, though we're so glad *${partnerRef}* could join us and be part of the celebration!\n\nYou were remembered with lots of warmth, and we hope we get to share another special moment with the two of you soon. ${sparkles}\n\n${signOff}`
  } else {
    msg = `Dear ${cleanName} ${heart}\n\nWe missed having you with us at ${eventLabel}. You were remembered with lots of warmth, and we hope we get to share another special moment together soon.\n\nSending you all our love and warm wishes. ${sparkles}\n\n${signOff}`
  }

  if (options?.cardUrl && options?.includeCardLink !== false) {
    msg += `\n\n${loveLetter} *Your Personalised Thank-You Card:*\n${options.cardUrl}`
  }

  return msg
}

/**
 * Standardised file naming convention per production specs:
 * `thankyou_ATTENDED_guestid.png`, `thankyou_SOIREE_ATTENDED_guestid.png`, etc.
 */
export function getThankYouCardFilename(
  variant: ThankYouVariant,
  guestIdOrCode: string,
  theme: ThankYouTheme = '40_festive'
): string {
  const safeId = (guestIdOrCode || 'guest').replace(/[^a-zA-Z0-9_-]/g, '')
  const themeTag = theme === 'soiree' ? '_SOIREE' : ''
  const prefix =
    variant === 'attended'
      ? `thankyou${themeTag}_ATTENDED`
      : variant === 'attended_partner_missed'
      ? `thankyou${themeTag}_ATTENDED_PARTNER_MISSED`
      : variant === 'missed_partner_attended'
      ? `thankyou${themeTag}_MISSED_PARTNER_ATTENDED`
      : `thankyou${themeTag}_MISSED`
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
 * Draws a line of text centered at (cx, y), bolding any occurrences of highlight word.
 */
function drawCanvasLineWithHighlight(
  ctx: CanvasRenderingContext2D,
  line: string,
  highlight: string | undefined,
  cx: number,
  y: number,
  regularFont: string,
  boldFont: string,
  regularColor: string,
  boldColor: string
): void {
  if (!highlight || !line.toLowerCase().includes(highlight.toLowerCase())) {
    ctx.font = regularFont
    ctx.fillStyle = regularColor
    ctx.textAlign = 'center'
    ctx.fillText(line, cx, y)
    return
  }

  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = line.split(regex)

  let totalWidth = 0
  const measuredParts: { text: string; isBold: boolean; width: number }[] = []

  for (const part of parts) {
    if (!part) continue
    const isBold = part.toLowerCase() === highlight.toLowerCase()
    ctx.font = isBold ? boldFont : regularFont
    const w = ctx.measureText(part).width
    measuredParts.push({ text: part, isBold, width: w })
    totalWidth += w
  }

  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  let currentX = cx - totalWidth / 2

  for (const p of measuredParts) {
    ctx.font = p.isBold ? boldFont : regularFont
    ctx.fillStyle = p.isBold ? boldColor : regularColor
    ctx.fillText(p.text, currentX, y)
    currentX += p.width
  }

  ctx.textAlign = prevAlign
  ctx.font = regularFont
  ctx.fillStyle = regularColor
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
  guestDisplayName: string,
  partnerInlineRef?: string,
  theme: ThankYouTheme = '40_festive'
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

  const copy = getThankYouCardCopy(variant, guestDisplayName, partnerInlineRef, theme)
  const cx = CARD_WIDTH / 2
  const maxContentWidth = CARD_WIDTH - SAFE_MARGIN * 2 // 888px safe width

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const isAttended = variant === 'attended' || variant === 'attended_partner_missed'

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

  // 2. Event title: "40 & FESTIVE" or "THE FESTIVE SOIRÉE"
  const isLongTitle = copy.eventTitle.length > 14
  ctx.font = `600 ${isLongTitle ? 50 : 66}px Cinzel, Georgia, serif`
  ctx.fillStyle = titleColor
  drawTrackedText(ctx, copy.eventTitle, cx, 290, isLongTitle ? 4.5 : 6)

  // 3. Subtitle: "ARPIT'S 40TH BIRTHDAY & DIWALI BASH" or "KHANDELWAL DIWALI CELEBRATION"
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
  const isTwoParagraphs = copy.bodyParagraphs.length > 1
  const fontSize = isTwoParagraphs ? 24 : 26
  const regularFont = `400 ${fontSize}px Inter, system-ui, sans-serif`
  const boldFont = `700 ${fontSize}px Inter, system-ui, sans-serif`
  const boldColor = isAttended ? '#FFF8E7' : '#1A0E05'

  ctx.font = regularFont
  ctx.fillStyle = bodyColor
  const bodyMaxWidth = 740
  const bodyLineHeight = isTwoParagraphs ? 38 : 42
  let currentBodyY = headlineY + (isTwoParagraphs ? 72 : 82)

  for (let p = 0; p < copy.bodyParagraphs.length; p++) {
    const lines = wrapCanvasText(ctx, copy.bodyParagraphs[p], bodyMaxWidth)
    for (const line of lines) {
      drawCanvasLineWithHighlight(
        ctx,
        line,
        copy.partnerHighlight,
        cx,
        currentBodyY,
        regularFont,
        boldFont,
        bodyColor,
        boldColor
      )
      currentBodyY += bodyLineHeight
    }
    if (p < copy.bodyParagraphs.length - 1) {
      currentBodyY += 18 // Paragraph spacing
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
