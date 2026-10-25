'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Guest,
  GuestInviteDetails,
  ActualAttendanceStatus,
  ThankYouDeliveryStatus,
  parseGuestNotes,
  chooseThankYou,
} from '@/lib/supabase'
import {
  ThankYouVariant,
  ThankYouTheme,
  resolveGuestDisplayName,
  resolveGuestAndPartnerNames,
  resolveGuestThankYouTheme,
  renderThankYouCardToCanvas,
  buildThankYouWhatsAppMessage,
  getThankYouCardFilename,
  getThankYouCardCopy,
} from '@/lib/thankYouCard'

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
            color: isAttended ? '#FFE699' : '#1A0E05',
          }}
        >
          {part}
        </strong>
      )
    }
    return part
  })
}

interface Props {
  guests: Guest[]
  allGuests: Guest[]
  guestMap: Record<string, { name: string; mobile: string }>
  baseUrl: string
  formatWhatsAppPhone: (rawMobile: string) => string
  onUpdateGuestDetails: (
    guest: Guest,
    updates: Partial<GuestInviteDetails>,
    syncCouple?: boolean
  ) => Promise<void>
  onBulkUpdateGuestDetails: (
    updatesList: Array<{ guest: Guest; updates: Partial<GuestInviteDetails> }>
  ) => Promise<void>
}

export default function ThankYouCampaignStudio({
  guests,
  allGuests,
  guestMap,
  baseUrl,
  formatWhatsAppPhone,
  onUpdateGuestDetails,
  onBulkUpdateGuestDetails,
}: Props) {
  // ── STUDIO PREVIEW STATE ──
  const [selectedGuestId, setSelectedGuestId] = useState<string>('')
  const [customPreviewName, setCustomPreviewName] = useState<string>('Mansi & Roshan')
  const [useCustomName, setUseCustomName] = useState<boolean>(false)
  const [studioTheme, setStudioTheme] = useState<ThankYouTheme>('40_festive')
  const [splitCouplePreviewMode, setSplitCouplePreviewMode] = useState<boolean>(false)
  const [mobilePreviewMode, setMobilePreviewMode] = useState<boolean>(false)
  const [includeCardLinkInWA, setIncludeCardLinkInWA] = useState<boolean>(true)
  const [autoCopyImageOnWA, setAutoCopyImageOnWA] = useState<boolean>(false)
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>('')
  const [studioToast, setStudioToast] = useState<string>('')

  // ── TABLE FILTER STATE ──
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'attended' | 'missed' | 'unknown' | 'ready_unsent' | 'sent'
  >('all')
  const [tableSearch, setTableSearch] = useState<string>('')
  const [modalGuest, setModalGuest] = useState<{
    guest: Guest
    variant: ThankYouVariant
    theme: ThankYouTheme
  } | null>(null)
  const [batchExporting, setBatchExporting] = useState<boolean>(false)

  // Canvases for side-by-side Card A/C (Attended) & Card B/D (Missed) + Modal
  const canvasAttendedRef = useRef<HTMLCanvasElement>(null)
  const canvasMissedRef = useRef<HTMLCanvasElement>(null)
  const canvasModalRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const leftPreviewVariant: ThankYouVariant = splitCouplePreviewMode
    ? 'attended_partner_missed'
    : 'attended'
  const rightPreviewVariant: ThankYouVariant = splitCouplePreviewMode
    ? 'missed_partner_attended'
    : 'missed'

  const showToast = (msg: string) => {
    setStudioToast(msg)
    setTimeout(() => setStudioToast(''), 3800)
  }

  // Helper to get effective Thank-You details for a guest
  const getGuestThankYouDetails = (g: Guest) => {
    const own = parseGuestNotes(g.notes)
    let partnerNotes: GuestInviteDetails = {}
    if (g.linked_guest_id) {
      const p = allGuests.find(x => x.id === g.linked_guest_id)
      if (p) partnerNotes = parseGuestNotes(p.notes)
    }

    let derivedFromPartner: ActualAttendanceStatus | undefined
    if (partnerNotes.attendance_status === 'attended_partner_missed') {
      derivedFromPartner = 'missed_partner_attended'
    } else if (partnerNotes.attendance_status === 'missed_partner_attended') {
      derivedFromPartner = 'attended_partner_missed'
    } else if (g.send_together) {
      derivedFromPartner = partnerNotes.attendance_status
    }

    const attendance_status: ActualAttendanceStatus =
      own.attendance_status || derivedFromPartner || 'unknown'

    const derivedType: ThankYouVariant | '' =
      attendance_status === 'attended'
        ? 'attended'
        : attendance_status === 'did_not_attend'
        ? 'missed'
        : attendance_status === 'attended_partner_missed'
        ? 'attended_partner_missed'
        : attendance_status === 'missed_partner_attended'
        ? 'missed_partner_attended'
        : ''

    const thank_you_type = own.thank_you_type || derivedType
    const thank_you_theme: ThankYouTheme = resolveGuestThankYouTheme(
      g,
      own.thank_you_theme || (g.send_together ? partnerNotes.thank_you_theme : '')
    )
    const thank_you_status: ThankYouDeliveryStatus = own.thank_you_status || 'pending'
    const thank_you_sent_at = own.thank_you_sent_at || ''

    // Phone resolution
    let rawPhone = g.mobile || ''
    if (!rawPhone.trim() && g.partner_mobile) rawPhone = g.partner_mobile
    if (!rawPhone.trim() && g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) {
      rawPhone = guestMap[g.linked_guest_id].mobile
    }
    const whatsapp_number = formatWhatsAppPhone(rawPhone)

    // RSVP status (kept strictly separate from attendance_status)
    const rawRsvp = (g.invitation_status || '').toLowerCase()
    const rsvp_status: 'confirmed' | 'declined' | 'pending' =
      rawRsvp === 'rsvp_yes' || rawRsvp === 'attending' || rawRsvp === 'yes'
        ? 'confirmed'
        : rawRsvp === 'rsvp_no' || rawRsvp === 'declined' || rawRsvp === 'no'
        ? 'declined'
        : 'pending'

    const activeVariantForName =
      derivedType || undefined
    const guest_display_name = resolveGuestDisplayName(g, allGuests, activeVariantForName)
    const { partnerInlineRef } = resolveGuestAndPartnerNames(g, allGuests)
    const routing = chooseThankYou({ whatsapp_number, attendance_status })
    const card_asset_url =
      thank_you_type
        ? `${baseUrl}/api/thank-you-card?code=${encodeURIComponent(g.invite_code)}&type=${thank_you_type}&theme=${thank_you_theme}`
        : ''

    return {
      guest_id: g.id,
      invite_code: g.invite_code,
      guest_display_name,
      partner_inline_ref: partnerInlineRef,
      whatsapp_number,
      raw_phone: rawPhone,
      rsvp_status,
      attendance_status,
      thank_you_type,
      thank_you_theme,
      thank_you_status,
      thank_you_sent_at,
      card_asset_url,
      routing,
    }
  }

  // Select default preview guest when guests load
  useEffect(() => {
    if (!selectedGuestId && guests.length > 0) {
      const coupleGuest = guests.find(g => g.send_together && g.partner_name) || guests[0]
      if (coupleGuest) {
        setSelectedGuestId(coupleGuest.id)
      }
    }
  }, [guests, selectedGuestId])

  const activePreviewGuest = useMemo(
    () => guests.find(g => g.id === selectedGuestId) || null,
    [guests, selectedGuestId]
  )

  const activePreviewName = useMemo(() => {
    if (useCustomName) return customPreviewName.trim() || 'Mansi & Roshan'
    if (activePreviewGuest) return resolveGuestDisplayName(activePreviewGuest, allGuests)
    return customPreviewName.trim() || 'Mansi & Roshan'
  }, [useCustomName, customPreviewName, activePreviewGuest, allGuests])

  const activePreviewPartnerRef = useMemo(() => {
    if (useCustomName) return undefined
    if (activePreviewGuest) {
      return resolveGuestAndPartnerNames(activePreviewGuest, allGuests).partnerInlineRef
    }
    return undefined
  }, [useCustomName, activePreviewGuest, allGuests])

  // Render both Left (Card A / C) & Right (Card B / D) whenever preview name, mode, or theme changes
  useEffect(() => {
    if (canvasAttendedRef.current) {
      renderThankYouCardToCanvas(
        canvasAttendedRef.current,
        leftPreviewVariant,
        activePreviewName,
        activePreviewPartnerRef,
        studioTheme
      )
    }
    if (canvasMissedRef.current) {
      renderThankYouCardToCanvas(
        canvasMissedRef.current,
        rightPreviewVariant,
        activePreviewName,
        activePreviewPartnerRef,
        studioTheme
      )
    }
  }, [activePreviewName, activePreviewPartnerRef, leftPreviewVariant, rightPreviewVariant, studioTheme])

  // Render modal canvas when modal opens
  useEffect(() => {
    if (modalGuest && canvasModalRef.current) {
      const name = resolveGuestDisplayName(modalGuest.guest, allGuests, modalGuest.variant)
      const { partnerInlineRef } = resolveGuestAndPartnerNames(modalGuest.guest, allGuests)
      renderThankYouCardToCanvas(
        canvasModalRef.current,
        modalGuest.variant,
        name,
        partnerInlineRef,
        modalGuest.theme
      )
    }
  }, [modalGuest, allGuests])

  // ── STATS COMPUTATION ──
  const stats = useMemo(() => {
    let attended = 0
    let missed = 0
    let unknown = 0
    let sent = 0
    let seen = 0
    let readyUnsent = 0
    let missingPhone = 0

    guests.forEach(g => {
      const d = getGuestThankYouDetails(g)
      if (
        d.attendance_status === 'attended' ||
        d.attendance_status === 'attended_partner_missed'
      ) {
        attended++
      } else if (
        d.attendance_status === 'did_not_attend' ||
        d.attendance_status === 'missed_partner_attended'
      ) {
        missed++
      } else {
        unknown++
      }

      if (d.thank_you_status === 'sent' || d.thank_you_status === 'delivered') sent++
      if (d.thank_you_status === 'seen') seen++
      if (
        d.attendance_status !== 'unknown' &&
        d.thank_you_status !== 'sent' &&
        d.thank_you_status !== 'delivered' &&
        d.thank_you_status !== 'seen' &&
        d.whatsapp_number
      ) {
        readyUnsent++
      }
      if (!d.whatsapp_number) missingPhone++
    })

    return {
      total: guests.length,
      attended,
      missed,
      unknown,
      sent,
      seen,
      readyUnsent,
      missingPhone,
    }
  }, [guests, allGuests, guestMap])

  // ── FILTERED GUESTS FOR RECONCILIATION & DELIVERY TABLE ──
  const filteredRows = useMemo(() => {
    return guests.filter(g => {
      const d = getGuestThankYouDetails(g)
      if (
        statusFilter === 'attended' &&
        d.attendance_status !== 'attended' &&
        d.attendance_status !== 'attended_partner_missed'
      ) {
        return false
      }
      if (
        statusFilter === 'missed' &&
        d.attendance_status !== 'did_not_attend' &&
        d.attendance_status !== 'missed_partner_attended'
      ) {
        return false
      }
      if (statusFilter === 'unknown' && d.attendance_status !== 'unknown') return false
      if (
        statusFilter === 'ready_unsent' &&
        !(
          d.attendance_status !== 'unknown' &&
          d.thank_you_status !== 'sent' &&
          d.thank_you_status !== 'delivered' &&
          d.thank_you_status !== 'seen'
        )
      ) {
        return false
      }
      if (
        statusFilter === 'sent' &&
        d.thank_you_status !== 'sent' &&
        d.thank_you_status !== 'delivered' &&
        d.thank_you_status !== 'seen'
      ) {
        return false
      }

      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        const hay = `${d.guest_display_name} ${g.first_name} ${g.last_name || ''} ${g.partner_name || ''} ${d.raw_phone} ${g.guest_of || ''} ${g.invite_code}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [guests, allGuests, statusFilter, tableSearch, guestMap])

  // ── HELPER: GENERATE PNG BLOB FOR ANY GUEST & VARIANT ──
  const generateCardBlob = async (
    variant: ThankYouVariant,
    displayName: string,
    partnerInlineRef?: string,
    theme: ThankYouTheme = studioTheme
  ): Promise<Blob | null> => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas')
    }
    const canvas = offscreenCanvasRef.current
    await renderThankYouCardToCanvas(canvas, variant, displayName, partnerInlineRef, theme)
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png', 1.0)
    })
  }

  // ── DOWNLOAD PNG FOR GUEST OR PREVIEW ──
  const handleDownloadCard = async (
    variant: ThankYouVariant,
    displayName: string,
    guestIdOrCode: string,
    partnerInlineRef?: string,
    theme: ThankYouTheme = studioTheme
  ) => {
    const blob = await generateCardBlob(variant, displayName, partnerInlineRef, theme)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getThankYouCardFilename(variant, guestIdOrCode, theme)
    a.click()
    URL.revokeObjectURL(url)
    showToast(`✅ Downloaded ${getThankYouCardFilename(variant, guestIdOrCode, theme)} (1080×1350 px)`)
  }

  // ── COPY CARD IMAGE TO CLIPBOARD ──
  const handleCopyCardImage = async (
    variant: ThankYouVariant,
    displayName: string,
    partnerInlineRef?: string,
    theme: ThankYouTheme = studioTheme
  ): Promise<boolean> => {
    try {
      const blob = await generateCardBlob(variant, displayName, partnerInlineRef, theme)
      if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
        showToast('⚠️ Clipboard image copy not supported in this browser; use Download PNG.')
        return false
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast(`📋 Copied Thank-You Card image to clipboard! Paste (Ctrl+V) in WhatsApp.`)
      return true
    } catch {
      showToast('⚠️ Could not copy image automatically — click Download PNG instead.')
      return false
    }
  }

  // ── SEND WHATSAPP THANK-YOU FOR A GUEST ──
  const handleSendThankYouWhatsApp = async (
    g: Guest,
    variantOverride?: ThankYouVariant,
    themeOverride?: ThankYouTheme
  ) => {
    const d = getGuestThankYouDetails(g)
    const activeTheme: ThankYouTheme = themeOverride || d.thank_you_theme
    const variant: ThankYouVariant | '' =
      variantOverride ||
      (d.attendance_status === 'attended'
        ? 'attended'
        : d.attendance_status === 'did_not_attend'
        ? 'missed'
        : d.attendance_status === 'attended_partner_missed'
        ? 'attended_partner_missed'
        : d.attendance_status === 'missed_partner_attended'
        ? 'missed_partner_attended'
        : '')

    if (!variant) {
      alert(
        `Attendance for "${d.guest_display_name}" is currently marked as Unknown.\n\nImportant rule: Please verify whether they Attended or Could Not Attend before sending their thank-you card.`
      )
      return
    }

    const resolvedName = resolveGuestDisplayName(g, allGuests, variant)

    if (autoCopyImageOnWA) {
      await handleCopyCardImage(variant, resolvedName, d.partner_inline_ref, activeTheme)
    }

    const typeParam =
      activeTheme === 'soiree' ? `thankyou_soiree_${variant}` : `thankyou_${variant}`
    const cardLink = `${baseUrl}/i/${g.invite_code}?type=${typeParam}&v=2`
    const msg = cardLink

    // Record status & timestamp in DB
    const nowIso = new Date().toISOString()
    await onUpdateGuestDetails(
      g,
      {
        thank_you_type: variant,
        thank_you_theme: activeTheme,
        thank_you_status: 'sent',
        thank_you_sent_at: nowIso,
        card_asset_url: `${baseUrl}/api/thank-you-card?code=${encodeURIComponent(g.invite_code)}&type=${variant}&theme=${activeTheme}`,
      },
      false
    )

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    const phone = d.whatsapp_number
    const targetUrl = isMobile
      ? phone
        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`
      : phone
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`

    window.open(targetUrl, '_blank')
  }

  // ── TEST SEND TO OWN NUMBER (Section 8) ──
  const handleTestSendToSelf = async (variant: ThankYouVariant) => {
    const cleanPhone = formatWhatsAppPhone(testPhoneNumber)
    if (!cleanPhone) {
      alert('Please enter your own WhatsApp number in the Test Number box first.')
      return
    }
    if (autoCopyImageOnWA) {
      await handleCopyCardImage(variant, activePreviewName, activePreviewPartnerRef, studioTheme)
    }
    const sampleCode = activePreviewGuest?.invite_code || 'TEST40'
    const typeParam =
      studioTheme === 'soiree' ? `thankyou_soiree_${variant}` : `thankyou_${variant}`
    const cardLink = `${baseUrl}/i/${sampleCode}?type=${typeParam}&v=2`
    const msg = cardLink
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    const targetUrl = isMobile
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
    window.open(targetUrl, '_blank')
  }

  // ── BULK RECONCILE FROM RSVP (Optional Helper) ──
  const handleSyncFromRsvp = async (mode: 'confirmed_to_attended' | 'declined_to_missed') => {
    const targets = guests.filter(g => {
      const d = getGuestThankYouDetails(g)
      if (d.attendance_status !== 'unknown') return false // Never overwrite already verified records
      if (mode === 'confirmed_to_attended') return d.rsvp_status === 'confirmed'
      return d.rsvp_status === 'declined'
    })

    if (targets.length === 0) {
      alert('No unverified guests match that RSVP status.')
      return
    }

    const label =
      mode === 'confirmed_to_attended'
        ? `Mark ${targets.length} unverified "RSVP Attending" guests as ATTENDED (Card A)?`
        : `Mark ${targets.length} unverified "RSVP Declined" guests as DID NOT ATTEND (Card B)?`

    if (!confirm(label)) return

    const updatesList = targets.map(guest => ({
      guest,
      updates: {
        attendance_status: (mode === 'confirmed_to_attended'
          ? 'attended'
          : 'did_not_attend') as ActualAttendanceStatus,
        thank_you_type: (mode === 'confirmed_to_attended' ? 'attended' : 'missed') as ThankYouVariant,
        thank_you_status: 'ready' as ThankYouDeliveryStatus,
      },
    }))

    await onBulkUpdateGuestDetails(updatesList)
    showToast(`✅ Updated ${targets.length} guests!`)
  }

  // ── BATCH DOWNLOAD VERIFIED CARDS ──
  const handleBatchDownloadVerified = async () => {
    const verified = filteredRows.filter(g => {
      const d = getGuestThankYouDetails(g)
      return d.attendance_status !== 'unknown'
    })

    if (verified.length === 0) {
      alert('No guests in the current view have verified attendance.')
      return
    }

    if (
      !confirm(
        `Download ${verified.length} personalised 1080×1350 PNG cards (${verified.length} files)?`
      )
    ) {
      return
    }

    setBatchExporting(true)
    try {
      for (let i = 0; i < verified.length; i++) {
        const g = verified[i]
        const d = getGuestThankYouDetails(g)
        const variant: ThankYouVariant =
          d.attendance_status === 'attended_partner_missed'
            ? 'attended_partner_missed'
            : d.attendance_status === 'missed_partner_attended'
            ? 'missed_partner_attended'
            : d.attendance_status === 'did_not_attend'
            ? 'missed'
            : 'attended'
        await handleDownloadCard(
          variant,
          d.guest_display_name,
          g.invite_code || g.id,
          d.partner_inline_ref,
          d.thank_you_theme
        )
        await new Promise(r => setTimeout(r, 280))
      }
      showToast(`✅ Batch exported ${verified.length} personalised cards!`)
    } finally {
      setBatchExporting(false)
    }
  }

  const copyAttendedMsg = buildThankYouWhatsAppMessage(leftPreviewVariant, activePreviewName, {
    includeCardLink: includeCardLinkInWA,
    cardUrl: `${baseUrl}/i/${activePreviewGuest?.invite_code || 'CODE'}?type=${studioTheme === 'soiree' ? `thankyou_soiree_${leftPreviewVariant}` : `thankyou_${leftPreviewVariant}`}`,
    partnerName: activePreviewPartnerRef,
    theme: studioTheme,
  })

  const copyMissedMsg = buildThankYouWhatsAppMessage(rightPreviewVariant, activePreviewName, {
    includeCardLink: includeCardLinkInWA,
    cardUrl: `${baseUrl}/i/${activePreviewGuest?.invite_code || 'CODE'}?type=${studioTheme === 'soiree' ? `thankyou_soiree_${rightPreviewVariant}` : `thankyou_${rightPreviewVariant}`}`,
    partnerName: activePreviewPartnerRef,
    theme: studioTheme,
  })

  return (
    <div className="w-full flex flex-col gap-6 px-4 sm:px-6 py-6 bg-[#050D1A]">
      {/* Floating Toast Notification */}
      {studioToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-sm bg-[#1C110B] border border-[#C9A84C] text-[#F5ECD7] text-xs font-sans shadow-2xl flex items-center gap-2">
          <span>{studioToast}</span>
        </div>
      )}

      {/* ══ 1. CAMPAIGN HERO BANNER & STATS SUMMARY ══ */}
      <div className="rounded-sm border border-[#C9A84C]/30 bg-gradient-to-r from-[#1A100A] via-[#0B172A] to-[#1A100A] p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#C9A84C]/15 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#E8D5A3] text-[10px] tracking-[0.25em] uppercase mb-2">
              <span>✨ Post-Event Thank-You Campaign</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#F5ECD7] tracking-wide">
              {studioTheme === 'soiree'
                ? 'THE FESTIVE SOIRÉE — Personalised Luxury Thank-You Suite'
                : '40 & FESTIVE — Personalised Luxury Thank-You Suite'}
            </h2>
            <p className="text-xs text-white/60 mt-1 max-w-3xl">
              Two bespoke 1080 × 1350 px (4:5 portrait) cards sharing one luxury visual identity across both{' '}
              <strong className="text-[#E8D5A3]">40 &amp; FESTIVE</strong> and{' '}
              <strong className="text-amber-300">THE FESTIVE SOIRÉE</strong>:
              <strong className="text-[#E8D5A3]"> Card A (Dark Walnut Edition)</strong> for guests who attended, and
              <strong className="text-[#F4E8D1]"> Card B (Champagne Edition)</strong> for guests who couldn&apos;t make it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Theme Switcher: 40 & Festive vs The Festive Soirée */}
            <div className="flex items-center bg-[#050D1A] border border-[#C9A84C]/45 rounded-sm p-1 gap-1">
              <button
                type="button"
                onClick={() => setStudioTheme('40_festive')}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                  studioTheme === '40_festive'
                    ? 'bg-[#C9A84C] text-[#050D1A] font-bold shadow'
                    : 'text-[#E8D5A3]/75 hover:text-white'
                }`}
              >
                🎂 40 &amp; Festive
              </button>
              <button
                type="button"
                onClick={() => setStudioTheme('soiree')}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                  studioTheme === 'soiree'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#050D1A] font-bold shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                🪔 The Festive Soirée
              </button>
            </div>

            <button
              type="button"
              onClick={handleBatchDownloadVerified}
              disabled={batchExporting}
              className="btn-primary px-4 py-2 text-xs uppercase tracking-widest flex items-center gap-1.5"
            >
              <span>⬇️</span>
              <span>
                {batchExporting
                  ? 'Exporting PNGs…'
                  : `Export Verified Cards (${stats.attended + stats.missed})`}
              </span>
            </button>
          </div>
        </div>

        {/* Campaign Funnel KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="p-3 rounded-sm bg-white/5 border border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Total Records</p>
            <p className="font-serif text-2xl text-[#F5ECD7] mt-0.5">{stats.total}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Existing Guest DB</p>
          </div>

          <div className="p-3 rounded-sm bg-[#261810]/80 border border-[#C9A84C]/35">
            <p className="text-[10px] uppercase tracking-widest text-[#E8D5A3]">Card A · Attended</p>
            <p className="font-serif text-2xl text-[#FFF5E0] font-bold mt-0.5">{stats.attended}</p>
            <p className="text-[10px] text-[#C9A84C]/80 mt-0.5">Dark Walnut Edition</p>
          </div>

          <div className="p-3 rounded-sm bg-[#F4E8D1]/10 border border-[#E8D5A3]/35">
            <p className="text-[10px] uppercase tracking-widest text-[#F4E8D1]">Card B · Missed</p>
            <p className="font-serif text-2xl text-[#F4E8D1] font-bold mt-0.5">{stats.missed}</p>
            <p className="text-[10px] text-[#E8D5A3]/70 mt-0.5">Champagne Edition</p>
          </div>

          <div className="p-3 rounded-sm bg-amber-500/10 border border-amber-500/30">
            <p className="text-[10px] uppercase tracking-widest text-amber-300">Needs Review</p>
            <p className="font-serif text-2xl text-amber-300 font-bold mt-0.5">{stats.unknown}</p>
            <p className="text-[10px] text-amber-200/60 mt-0.5">Held from auto-send</p>
          </div>

          <div className="p-3 rounded-sm bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-[10px] uppercase tracking-widest text-emerald-300">Ready to Send</p>
            <p className="font-serif text-2xl text-emerald-300 font-bold mt-0.5">{stats.readyUnsent}</p>
            <p className="text-[10px] text-emerald-200/60 mt-0.5">Verified &amp; Unsent</p>
          </div>

          <div className="p-3 rounded-sm bg-blue-500/10 border border-blue-500/30">
            <p className="text-[10px] uppercase tracking-widest text-blue-300">Sent &amp; Seen</p>
            <p className="font-serif text-2xl text-blue-300 font-bold mt-0.5">
              {stats.sent + stats.seen}
            </p>
            <p className="text-[10px] text-blue-200/70 mt-0.5">
              {stats.seen} Seen · {stats.sent} Sent
            </p>
          </div>
        </div>
      </div>

      {/* ══ 2. MASTER CARD DESIGN STUDIO & LIVE PREVIEW (1080 × 1350 PX) ══ */}
      <div className="rounded-sm border border-[#C9A84C]/25 bg-[#081326] p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
          <div>
            <h3 className="font-serif text-lg text-[#F5ECD7] flex items-center gap-2">
              <span>🎨</span>
              <span>Master Layout &amp; Two Visual Variants — Live 1080 × 1350 px Studio</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Real programmatic typography rendered over fixed luxury walnut &amp; champagne textures. Safe margin ≥ 96 px (exceeds 70 px spec).
            </p>
          </div>

          {/* Quality Check & Name Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#050D1A] border border-[#C9A84C]/35 rounded-sm p-0.5 gap-1">
              <button
                type="button"
                onClick={() => setSplitCouplePreviewMode(false)}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                  !splitCouplePreviewMode
                    ? 'bg-[#C9A84C] text-[#050D1A] font-bold'
                    : 'text-[#E8D5A3]/70 hover:text-white'
                }`}
              >
                👥 Standard (Card A &amp; Card B)
              </button>
              <button
                type="button"
                onClick={() => setSplitCouplePreviewMode(true)}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                  splitCouplePreviewMode
                    ? 'bg-[#C9A84C] text-[#050D1A] font-bold'
                    : 'text-[#E8D5A3]/70 hover:text-white'
                }`}
              >
                💔 Split Couple (Partner Missed / Partner Came)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobilePreviewMode(prev => !prev)}
              className={`px-3 py-1.5 rounded-sm text-xs border transition-all ${
                mobilePreviewMode
                  ? 'bg-[#C9A84C] text-[#050D1A] font-bold border-[#C9A84C]'
                  : 'bg-white/5 text-[#C9A84C] border-[#C9A84C]/40 hover:border-[#C9A84C]'
              }`}
            >
              📱 {mobilePreviewMode ? 'Mobile Screen Size: ON' : 'Preview at Mobile Screen Size'}
            </button>
          </div>
        </div>

        {/* Guest / Sample Name Selector Bar (Step 4: Preview single guest, couple, family) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 p-3.5 rounded-sm bg-[#050D1A] border border-[#C9A84C]/20">
          <div className="lg:col-span-4">
            <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
              1. Preview From Guest Database:
            </label>
            <select
              value={useCustomName ? '__custom__' : selectedGuestId}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setUseCustomName(true)
                } else {
                  setUseCustomName(false)
                  setSelectedGuestId(e.target.value)
                  const picked = guests.find(x => x.id === e.target.value)
                  if (picked) {
                    setStudioTheme(getGuestThankYouDetails(picked).thank_you_theme)
                  }
                }
              }}
              className="w-full bg-[#0A1931] border border-[#C9A84C]/40 rounded-sm px-3 py-2 text-xs text-[#F5ECD7] outline-none"
            >
              <option value="__custom__">✍️ Custom / Sample Test Name</option>
              {guests.map(g => {
                const d = getGuestThankYouDetails(g)
                return (
                  <option key={g.id} value={g.id}>
                    {d.guest_display_name} ({d.attendance_status === 'attended' ? '✨ Attended' : d.attendance_status === 'did_not_attend' ? '🤍 Missed' : d.attendance_status === 'attended_partner_missed' ? '🟫🥂 Came, Partner Missed' : d.attendance_status === 'missed_partner_attended' ? '🥂🟫 Missed, Partner Came' : '❓ Unverified'})
                  </option>
                )
              })}
            </select>
          </div>

          <div className="lg:col-span-4">
            <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
              2. Or Test Specific Display Name (Single / Couple / Family):
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={activePreviewName}
                onChange={e => {
                  setUseCustomName(true)
                  setCustomPreviewName(e.target.value)
                }}
                placeholder="e.g. Mansi & Roshan"
                className="flex-1 bg-white/5 border border-white/15 rounded-sm px-3 py-1.5 text-xs text-white outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[
                { label: 'Couple: Mansi & Roshan', val: 'Mansi & Roshan' },
                { label: 'Single: Aarav', val: 'Aarav' },
                { label: 'Long: Siddharth & Ananya', val: 'Siddharth & Ananya' },
                { label: 'Family: Rohan, Meera & Family', val: 'Rohan, Meera & Family' },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setUseCustomName(true)
                    setCustomPreviewName(preset.val)
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-[#C9A84C]/20 text-[#E8D5A3] border border-[#C9A84C]/25 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                3. WhatsApp Delivery Options &amp; Self-Test:
              </label>
              <div className="flex flex-col gap-1 text-[11px] text-white/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCopyImageOnWA}
                    onChange={e => setAutoCopyImageOnWA(e.target.checked)}
                    className="accent-[#C9A84C]"
                  />
                  <span>Auto-copy 1080×1350 Card PNG to clipboard on &ldquo;Send WA&rdquo;</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCardLinkInWA}
                    onChange={e => setIncludeCardLinkInWA(e.target.checked)}
                    className="accent-[#C9A84C]"
                  />
                  <span>Append interactive web card link to WhatsApp text</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <input
                type="text"
                value={testPhoneNumber}
                onChange={e => setTestPhoneNumber(e.target.value)}
                placeholder="Your number for test send (e.g. +91 9876543210)"
                className="flex-1 bg-white/5 border border-white/15 rounded-sm px-2.5 py-1 text-[11px] text-white font-mono outline-none focus:border-[#C9A84C]"
              />
            </div>
          </div>
        </div>

        {/* ── SIDE-BY-SIDE CARDS + EXACT WHATSAPP MESSAGES ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── LEFT CARD: ATTENDED / CAME (PARTNER MISSED) ── */}
          <div className="rounded-sm border border-[#C9A84C]/35 bg-[#120B07]/90 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#C9A84C]/20">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-[#C9A84C]/20 text-[#E8D5A3] font-semibold">
                    {splitCouplePreviewMode
                      ? 'Card C · Guest Came, Partner Missed (`thankyou_attended_partner_missed`)'
                      : 'Card A · Attended (`thankyou_attended`)'}
                  </span>
                  <h4 className="font-serif text-lg text-[#F5ECD7] mt-1">
                    {splitCouplePreviewMode
                      ? 'Dark Walnut — "Thank you for coming · We missed your partner"'
                      : 'Dark Walnut Edition — "The night was better with you."'}
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-white/40">1080 × 1350 · 4:5</span>
              </div>

              {/* Canvas Preview Container */}
              <div className="flex justify-center my-2">
                <div
                  className={`relative transition-all duration-300 ${
                    mobilePreviewMode
                      ? 'w-[270px] rounded-[28px] p-2.5 bg-black border-4 border-neutral-700 shadow-2xl'
                      : 'w-full max-w-[360px]'
                  }`}
                >
                  <canvas
                    ref={canvasAttendedRef}
                    width={1080}
                    height={1350}
                    className="w-full h-auto aspect-[4/5] rounded-sm shadow-2xl border border-[#C9A84C]/30"
                  />
                </div>
              </div>

              {/* Action Bar for Left Card */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadCard(
                      leftPreviewVariant,
                      activePreviewName,
                      activePreviewGuest?.invite_code || 'sample',
                      activePreviewPartnerRef
                    )
                  }
                  className="px-3 py-1.5 rounded-sm bg-[#C9A84C] text-[#050D1A] font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
                >
                  ⬇️ Download PNG
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCardImage(
                      leftPreviewVariant,
                      activePreviewName,
                      activePreviewPartnerRef
                    )
                  }
                  className="px-3 py-1.5 rounded-sm border border-[#C9A84C]/50 text-[#E8D5A3] hover:bg-[#C9A84C]/15 text-xs transition-all cursor-pointer"
                >
                  📋 Copy Card Image
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSendToSelf(leftPreviewVariant)}
                  className="px-3 py-1.5 rounded-sm border border-green-500/40 text-green-400 hover:bg-green-500/15 text-xs transition-all cursor-pointer"
                >
                  💬 Test Send {splitCouplePreviewMode ? 'Card C' : 'Card A'}
                </button>
              </div>
            </div>

            {/* Exact WhatsApp Message Box A / C */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-[#C9A84C]">
                  {splitCouplePreviewMode
                    ? 'C. Guest Came, Partner Missed — WhatsApp Message'
                    : 'A. Attended — Exact WhatsApp Message (`thankyou_attended_whatsapp`)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(copyAttendedMsg)
                    showToast('📋 Copied WhatsApp message!')
                  }}
                  className="text-[10px] text-[#E8D5A3] hover:underline"
                >
                  📋 Copy Text
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-[#F5ECD7]/90 bg-black/50 border border-white/10 rounded-sm p-3 leading-relaxed">
                {copyAttendedMsg}
              </pre>
            </div>
          </div>

          {/* ── RIGHT CARD: COULD NOT ATTEND / MISSED (PARTNER CAME) ── */}
          <div className="rounded-sm border border-[#E8D5A3]/35 bg-[#1B150E]/90 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#E8D5A3]/20">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-[#F4E8D1]/20 text-[#F4E8D1] font-semibold">
                    {splitCouplePreviewMode
                      ? 'Card D · Guest Missed, Partner Came (`thankyou_missed_partner_attended`)'
                      : 'Card B · Could Not Attend (`thankyou_missed`)'}
                  </span>
                  <h4 className="font-serif text-lg text-[#F4E8D1] mt-1">
                    {splitCouplePreviewMode
                      ? 'Champagne — "We missed you · Wonderful having your partner join"'
                      : 'Champagne Edition — "YOU WERE MISSED."'}
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-white/40">1080 × 1350 · 4:5</span>
              </div>

              {/* Canvas Preview Container */}
              <div className="flex justify-center my-2">
                <div
                  className={`relative transition-all duration-300 ${
                    mobilePreviewMode
                      ? 'w-[270px] rounded-[28px] p-2.5 bg-black border-4 border-neutral-700 shadow-2xl'
                      : 'w-full max-w-[360px]'
                  }`}
                >
                  <canvas
                    ref={canvasMissedRef}
                    width={1080}
                    height={1350}
                    className="w-full h-auto aspect-[4/5] rounded-sm shadow-2xl border border-[#E8D5A3]/40"
                  />
                </div>
              </div>

              {/* Action Bar for Right Card */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadCard(
                      rightPreviewVariant,
                      activePreviewName,
                      activePreviewGuest?.invite_code || 'sample',
                      activePreviewPartnerRef
                    )
                  }
                  className="px-3 py-1.5 rounded-sm bg-[#F4E8D1] text-[#2E1C0E] font-bold text-xs hover:brightness-105 transition-all cursor-pointer"
                >
                  ⬇️ Download PNG
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCardImage(
                      rightPreviewVariant,
                      activePreviewName,
                      activePreviewPartnerRef
                    )
                  }
                  className="px-3 py-1.5 rounded-sm border border-[#F4E8D1]/50 text-[#F4E8D1] hover:bg-[#F4E8D1]/15 text-xs transition-all cursor-pointer"
                >
                  📋 Copy Card Image
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSendToSelf(rightPreviewVariant)}
                  className="px-3 py-1.5 rounded-sm border border-green-500/40 text-green-400 hover:bg-green-500/15 text-xs transition-all cursor-pointer"
                >
                  💬 Test Send {splitCouplePreviewMode ? 'Card D' : 'Card B'}
                </button>
              </div>
            </div>

            {/* Exact WhatsApp Message Box B / D */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-[#F4E8D1]">
                  {splitCouplePreviewMode
                    ? 'D. Guest Missed, Partner Came — WhatsApp Message'
                    : "B. Couldn't Attend — Exact WhatsApp Message (`thankyou_missed_whatsapp`)"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(copyMissedMsg)
                    showToast('📋 Copied WhatsApp message!')
                  }}
                  className="text-[10px] text-[#F4E8D1] hover:underline"
                >
                  📋 Copy Text
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-[#F5ECD7]/90 bg-black/50 border border-white/10 rounded-sm p-3 leading-relaxed">
                {copyMissedMsg}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 3. ATTENDANCE RECONCILIATION & WHATSAPP DELIVERY TABLE ══ */}
      <div className="rounded-sm border border-[#C9A84C]/25 bg-[#081326] p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
          <div>
            <h3 className="font-serif text-lg text-[#F5ECD7] flex items-center gap-2">
              <span>📋</span>
              <span>Attendance Reconciliation &amp; Personalised Thank-You Delivery</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              `rsvp_status` is preserved separately from `attendance_status`. Guests with `unknown` attendance are held from sending until verified.
            </p>
          </div>

          {/* Optional Reconciliation Helpers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSyncFromRsvp('confirmed_to_attended')}
              className="px-3 py-1.5 rounded-sm text-[11px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all cursor-pointer"
              title="Marks currently Unverified guests who RSVPed 'Attending' as Attended"
            >
              ✓ Reconcile: Mark Confirmed RSVPs as Attended
            </button>
            <button
              type="button"
              onClick={() => handleSyncFromRsvp('declined_to_missed')}
              className="px-3 py-1.5 rounded-sm text-[11px] bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 transition-all cursor-pointer"
              title="Marks currently Unverified guests who RSVPed 'Declined' as Did Not Attend"
            >
              ✓ Reconcile: Mark Declined RSVPs as Missed
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All (${stats.total})` },
              { id: 'attended', label: `✨ Attended · Card A/C (${stats.attended})` },
              { id: 'missed', label: `🤍 Missed · Card B/D (${stats.missed})` },
              { id: 'unknown', label: `⚠️ Unverified / Review (${stats.unknown})` },
              { id: 'ready_unsent', label: `⏳ Verified & Unsent (${stats.readyUnsent})` },
              { id: 'sent', label: `📨 Sent / Seen (${stats.sent + stats.seen})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#C9A84C] text-[#050D1A] border-[#C9A84C] font-bold'
                    : 'bg-white/5 text-white/70 border-white/10 hover:border-[#C9A84C]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            placeholder="Filter by guest display name, phone, code..."
            className="w-full sm:w-64 bg-white/5 border border-white/15 rounded-sm px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#C9A84C]"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#C9A84C]/20 text-[10px] uppercase tracking-wider text-white/40 bg-[#050D1A]/60">
                <th className="px-3 py-2.5 text-left">`guest_display_name` (On Card)</th>
                <th className="px-3 py-2.5 text-left">`whatsapp_number`</th>
                <th className="px-3 py-2.5 text-left">`rsvp_status`</th>
                <th className="px-3 py-2.5 text-left text-[#C9A84C]">`attendance_status` (Verify)</th>
                <th className="px-3 py-2.5 text-left">`thank_you_type` (Routing)</th>
                <th className="px-3 py-2.5 text-left">`thank_you_status`</th>
                <th className="px-3 py-2.5 text-left">`thank_you_sent_at`</th>
                <th className="px-3 py-2.5 text-left">Card &amp; WhatsApp Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-white/40">
                    No guest records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map(g => {
                  const d = getGuestThankYouDetails(g)
                  const activeVariant: ThankYouVariant =
                    d.attendance_status === 'attended_partner_missed'
                      ? 'attended_partner_missed'
                      : d.attendance_status === 'missed_partner_attended'
                      ? 'missed_partner_attended'
                      : d.attendance_status === 'did_not_attend'
                      ? 'missed'
                      : 'attended'

                  return (
                    <tr
                      key={g.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* guest_display_name */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-serif text-sm text-[#F5ECD7] font-medium">
                            {d.guest_display_name}
                          </span>
                          <span className="text-[10px] text-white/35 font-mono">
                            ID: {g.invite_code} · Host: {g.guest_of || '—'}
                          </span>
                        </div>
                      </td>

                      {/* whatsapp_number */}
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {d.whatsapp_number ? (
                          <span className="text-white/80">+{d.whatsapp_number}</span>
                        ) : (
                          <span className="text-red-400/70 text-[10px]">Missing Number</span>
                        )}
                      </td>

                      {/* rsvp_status (Separate from actual attendance) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {d.rsvp_status === 'confirmed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-500/15 text-green-400 border border-green-500/30">
                            Confirmed
                          </span>
                        ) : d.rsvp_status === 'declined' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-400 border border-red-500/30">
                            Declined
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/40 border border-white/10">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* attendance_status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <select
                          value={d.attendance_status}
                          onChange={e => {
                            const val = e.target.value as ActualAttendanceStatus
                            const nextType: ThankYouVariant | '' =
                              val === 'attended'
                                ? 'attended'
                                : val === 'did_not_attend'
                                ? 'missed'
                                : val === 'attended_partner_missed'
                                ? 'attended_partner_missed'
                                : val === 'missed_partner_attended'
                                ? 'missed_partner_attended'
                                : ''
                            const nextStatus: ThankYouDeliveryStatus =
                              val === 'unknown'
                                ? 'pending'
                                : d.thank_you_status === 'pending'
                                ? 'ready'
                                : d.thank_you_status
                            onUpdateGuestDetails(
                              g,
                              {
                                attendance_status: val,
                                thank_you_type: nextType,
                                thank_you_status: nextStatus,
                              },
                              true
                            )
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full outline-none cursor-pointer border transition-all ${
                            d.attendance_status === 'attended' ||
                            d.attendance_status === 'attended_partner_missed'
                              ? 'bg-[#2C1B11] text-[#E8D5A3] border-[#C9A84C]/60'
                              : d.attendance_status === 'did_not_attend' ||
                                d.attendance_status === 'missed_partner_attended'
                              ? 'bg-[#F4E8D1]/15 text-[#F4E8D1] border-[#F4E8D1]/50'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <option value="unknown" className="bg-[#0A1931] text-amber-300">
                            ❓ Unknown (Review)
                          </option>
                          <option value="attended" className="bg-[#0A1931] text-[#E8D5A3]">
                            ✨ Attended (Both/Solo)
                          </option>
                          <option value="did_not_attend" className="bg-[#0A1931] text-[#F4E8D1]">
                            🤍 Did Not Attend (Both/Solo)
                          </option>
                          <option value="attended_partner_missed" className="bg-[#0A1931] text-emerald-300">
                            🟫🥂 Came · Partner Missed
                          </option>
                          <option value="missed_partner_attended" className="bg-[#0A1931] text-amber-200">
                            🥂🟫 Missed · Partner Came
                          </option>
                        </select>
                      </td>

                      {/* thank_you_type / chooseThankYou decision + Theme selector */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <select
                            value={d.thank_you_theme}
                            onChange={e =>
                              onUpdateGuestDetails(
                                g,
                                { thank_you_theme: e.target.value as ThankYouTheme },
                                true
                              )
                            }
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded outline-none cursor-pointer border ${
                              d.thank_you_theme === 'soiree'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-[#C9A84C]/15 text-[#E8D5A3] border-[#C9A84C]/40'
                            }`}
                            title="Select Event Theme for Thank-You Card"
                          >
                            <option value="40_festive" className="bg-[#0A1931] text-[#E8D5A3]">
                              🎂 40 &amp; Festive
                            </option>
                            <option value="soiree" className="bg-[#0A1931] text-amber-300">
                              🪔 The Festive Soirée
                            </option>
                          </select>
                          {d.routing.action === 'skip' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-300 border border-red-500/25">
                              ⏭️ Skip: Missing Phone
                            </span>
                          ) : d.routing.action === 'review' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/25">
                              ⚠️ Hold: Verify Attendance
                            </span>
                          ) : d.routing.type === 'attended' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#2C1B11] text-[#E8D5A3] border border-[#C9A84C]/50 font-medium">
                              🟫 Card A · Attended (Walnut)
                            </span>
                          ) : d.routing.type === 'attended_partner_missed' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#2C1B11] text-emerald-300 border border-emerald-500/50 font-medium">
                              🟫🥂 Card C · Came, Partner Missed
                            </span>
                          ) : d.routing.type === 'missed_partner_attended' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4E8D1]/15 text-amber-200 border border-amber-400/50 font-medium">
                              🥂🟫 Card D · Missed, Partner Came
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4E8D1]/15 text-[#F4E8D1] border border-[#F4E8D1]/40 font-medium">
                              🥂 Card B · Missed (Champagne)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* thank_you_status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <select
                          value={d.thank_you_status}
                          onChange={e =>
                            onUpdateGuestDetails(
                              g,
                              { thank_you_status: e.target.value as ThankYouDeliveryStatus },
                              false
                            )
                          }
                          className={`text-[10px] font-semibold px-2 py-1 rounded outline-none cursor-pointer border ${
                            d.thank_you_status === 'seen' || d.thank_you_status === 'delivered'
                              ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'
                              : d.thank_you_status === 'sent'
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                              : d.thank_you_status === 'ready'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : d.thank_you_status === 'failed'
                              ? 'bg-red-500/15 text-red-300 border-red-500/40'
                              : 'bg-white/5 text-white/50 border-white/10'
                          }`}
                        >
                          <option value="pending" className="bg-[#0A1931] text-white/60">
                            ⏳ PENDING
                          </option>
                          <option value="ready" className="bg-[#0A1931] text-emerald-300">
                            ✅ READY
                          </option>
                          <option value="sent" className="bg-[#0A1931] text-blue-300">
                            📨 SENT
                          </option>
                          <option value="delivered" className="bg-[#0A1931] text-yellow-300">
                            ✓✓ DELIVERED
                          </option>
                          <option value="seen" className="bg-[#0A1931] text-yellow-300">
                            👁️ SEEN
                          </option>
                          <option value="failed" className="bg-[#0A1931] text-red-400">
                            ⚠️ FAILED
                          </option>
                        </select>
                      </td>

                      {/* thank_you_sent_at */}
                      <td className="px-3 py-2.5 font-mono text-[10px] text-white/50 whitespace-nowrap">
                        {d.thank_you_sent_at
                          ? new Date(d.thank_you_sent_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setUseCustomName(false)
                              setSelectedGuestId(g.id)
                              setStudioTheme(d.thank_you_theme)
                              setModalGuest({
                                guest: g,
                                variant: activeVariant,
                                theme: d.thank_you_theme,
                              })
                            }}
                            className="px-2 py-1 rounded-sm border border-[#C9A84C]/40 text-[#E8D5A3] hover:bg-[#C9A84C]/15 text-[10px] cursor-pointer"
                            title="Preview 1080×1350 Card for this guest"
                          >
                            👁️ Preview
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadCard(
                                activeVariant,
                                d.guest_display_name,
                                g.invite_code || g.id,
                                d.partner_inline_ref,
                                d.thank_you_theme
                              )
                            }
                            className="px-2 py-1 rounded-sm border border-white/20 text-white/80 hover:bg-white/10 text-[10px] cursor-pointer"
                            title={`Download ${getThankYouCardFilename(activeVariant, g.invite_code || g.id, d.thank_you_theme)}`}
                          >
                            ⬇️ PNG
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendThankYouWhatsApp(g)}
                            disabled={d.attendance_status === 'unknown'}
                            className={`px-2.5 py-1 rounded-sm text-[10px] font-semibold transition-all ${
                              d.attendance_status === 'unknown'
                                ? 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
                                : 'bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 cursor-pointer'
                            }`}
                            title={
                              d.attendance_status === 'unknown'
                                ? 'Verify attendance before sending'
                                : `Copy Card & Send WhatsApp to ${d.guest_display_name}`
                            }
                          >
                            💬 Send WA
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 4. CAMPAIGN SCHEDULE & PRIVACY GUIDELINES ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-sm border border-[#C9A84C]/20 bg-[#081326] p-5">
          <h4 className="font-serif text-base text-[#E8D5A3] mb-3 flex items-center gap-2">
            <span>🗓️</span>
            <span>Recommended Delivery Schedule</span>
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded bg-white/5 border border-white/10 flex justify-between gap-4">
              <span className="font-semibold text-[#F5ECD7] whitespace-nowrap">Day 1 after the party</span>
              <span className="text-white/70 text-right">
                Send the personalised thank-you cards to both verified groups (`attended` &amp; `did_not_attend`).
              </span>
            </div>
            <div className="p-2.5 rounded bg-white/5 border border-white/10 flex justify-between gap-4">
              <span className="font-semibold text-[#F5ECD7] whitespace-nowrap">Day 1–2</span>
              <span className="text-white/70 text-right">
                Review delivery failures and correct invalid numbers or technical errors.
              </span>
            </div>
            <div className="p-2.5 rounded bg-white/5 border border-white/10 flex justify-between gap-4">
              <span className="font-semibold text-[#F5ECD7] whitespace-nowrap">Day 3</span>
              <span className="text-white/70 text-right">
                Check whether any guests remain unclassified (`unknown`); do not send an assumed version.
              </span>
            </div>
            <div className="p-2.5 rounded bg-white/5 border border-white/10 flex justify-between gap-4">
              <span className="font-semibold text-[#F5ECD7] whitespace-nowrap">Later, if desired</span>
              <span className="text-white/70 text-right">
                Share a separate photo gallery or event highlights once available.
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-[#C9A84C]/20 bg-[#081326] p-5">
          <h4 className="font-serif text-base text-[#E8D5A3] mb-3 flex items-center gap-2">
            <span>🔒</span>
            <span>Design Rules &amp; Privacy Safeguards Active</span>
          </h4>
          <ul className="space-y-2 text-xs text-white/75 list-disc list-inside">
            <li>
              <strong className="text-[#F5ECD7]">No system status on cards:</strong> Attendance status, RSVP wording, and absence reasons never appear on the guest-facing card.
            </li>
            <li>
              <strong className="text-[#F5ECD7]">Separate `rsvp_status` &amp; `attendance_status`:</strong> Declined RSVPs and confirmed no-shows retain distinct internal records while receiving the warm Champagne Edition card.
            </li>
            <li>
              <strong className="text-[#F5ECD7]">Unverified guardrails:</strong> Unknown attendance records are locked from sending until explicitly reviewed.
            </li>
            <li>
              <strong className="text-[#F5ECD7]">One card per household/couple:</strong> Couples marked &ldquo;Together&rdquo; automatically receive a single card addressed to both names (e.g. <em>MANSI &amp; ROSHAN</em>).
            </li>
          </ul>
        </div>
      </div>

      {/* ══ MODAL FOR SINGLE GUEST CARD INSPECTION & SEND ══ */}
      {modalGuest && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalGuest(null)}
        >
          <div
            className="glass max-w-3xl w-full rounded-sm p-6 border border-[#C9A84C]/40 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const d = getGuestThankYouDetails(modalGuest.guest)
              const resolvedModalName = resolveGuestDisplayName(
                modalGuest.guest,
                allGuests,
                modalGuest.variant
              )
              const copy = getThankYouCardCopy(
                modalGuest.variant,
                resolvedModalName,
                d.partner_inline_ref,
                modalGuest.theme
              )
              const modalTypeParam =
                modalGuest.theme === 'soiree'
                  ? `thankyou_soiree_${modalGuest.variant}`
                  : `thankyou_${modalGuest.variant}`
              const waMsg = buildThankYouWhatsAppMessage(
                modalGuest.variant,
                resolvedModalName,
                {
                  includeCardLink: includeCardLinkInWA,
                  cardUrl: `${baseUrl}/i/${modalGuest.guest.invite_code}?type=${modalTypeParam}`,
                  partnerName: d.partner_inline_ref,
                  theme: modalGuest.theme,
                }
              )

              return (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="font-serif text-xl text-[#F5ECD7]">
                        Preview — {resolvedModalName}
                      </h3>
                      <p className="text-xs text-white/50">
                        File: `{getThankYouCardFilename(modalGuest.variant, modalGuest.guest.invite_code, modalGuest.theme)}` · 1080 × 1350 px (Portrait 4:5)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={modalGuest.theme}
                        onChange={e =>
                          setModalGuest({
                            ...modalGuest,
                            theme: e.target.value as ThankYouTheme,
                          })
                        }
                        className="bg-[#0A1931] px-3 py-1 rounded border border-amber-500/40 text-xs text-amber-300 outline-none cursor-pointer"
                      >
                        <option value="40_festive">🎂 40 &amp; Festive</option>
                        <option value="soiree">🪔 The Festive Soirée</option>
                      </select>
                      <select
                        value={modalGuest.variant}
                        onChange={e =>
                          setModalGuest({
                            ...modalGuest,
                            variant: e.target.value as ThankYouVariant,
                          })
                        }
                        className="bg-[#0A1931] px-3 py-1 rounded border border-[#C9A84C]/40 text-xs text-[#E8D5A3] outline-none cursor-pointer"
                      >
                        <option value="attended">🟫 Card A — Attended (Both/Solo)</option>
                        <option value="missed">🥂 Card B — Missed (Both/Solo)</option>
                        <option value="attended_partner_missed">🟫🥂 Card C — Came, Partner Missed</option>
                        <option value="missed_partner_attended">🥂🟫 Card D — Missed, Partner Came</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setModalGuest(null)}
                        className="text-white/40 hover:text-white text-xl px-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col items-center">
                      <canvas
                        ref={canvasModalRef}
                        width={1080}
                        height={1350}
                        className="w-full max-w-[320px] h-auto aspect-[4/5] rounded-sm shadow-2xl border border-[#C9A84C]/40"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                          Card Headline &amp; Copy
                        </span>
                        <div className="p-3 rounded bg-black/40 border border-white/10 text-xs text-white/80 space-y-1">
                          <p className="text-[10px] uppercase tracking-wider text-amber-300">
                            {copy.eventTitle} — {copy.eventSubtitle}
                          </p>
                          <p className="text-[#E8D5A3] font-semibold">{copy.guestDisplayName}</p>
                          <p className="italic">{copy.headline}</p>
                          {copy.bodyParagraphs.map((p, idx) => (
                            <p key={idx} className="text-white/60">
                              {renderFormattedParagraph(p, copy.partnerHighlight, true)}
                            </p>
                          ))}
                          <p className="text-[10px] uppercase tracking-wider text-[#C9A84C] pt-1">
                            {copy.signOffLabel} {copy.signature}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                          Matching WhatsApp Message
                        </span>
                        <pre className="whitespace-pre-wrap font-sans text-xs text-[#F5ECD7]/90 bg-black/50 border border-white/10 rounded-sm p-3 leading-relaxed">
                          {waMsg}
                        </pre>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadCard(
                              modalGuest.variant,
                              resolvedModalName,
                              modalGuest.guest.invite_code,
                              d.partner_inline_ref,
                              modalGuest.theme
                            )
                          }
                          className="btn-primary py-2.5 px-4 text-xs uppercase tracking-widest"
                        >
                          ⬇️ Download High-Res PNG (1080×1350)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyCardImage(
                              modalGuest.variant,
                              resolvedModalName,
                              d.partner_inline_ref,
                              modalGuest.theme
                            )
                          }
                          className="btn-outline py-2 px-4 text-xs uppercase tracking-widest"
                        >
                          📋 Copy Card Image to Clipboard
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSendThankYouWhatsApp(
                              modalGuest.guest,
                              modalGuest.variant,
                              modalGuest.theme
                            )
                            setModalGuest(null)
                          }}
                          className="py-2.5 px-4 rounded-sm bg-green-600 hover:bg-green-500 text-white font-semibold text-xs uppercase tracking-widest transition-all cursor-pointer"
                        >
                          💬 Copy Card &amp; Send via WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
