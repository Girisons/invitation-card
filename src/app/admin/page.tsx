'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Guest } from '@/lib/supabase'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'arpit40'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (India)' },
  { code: '+65', label: '🇸🇬 +65 (Singapore)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+1', label: '🇺🇸 +1 (USA/Canada)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+60', label: '🇲🇾 +60 (Malaysia)' },
  { code: '+61', label: '🇦🇺 +61 (Australia)' },
  { code: '+66', label: '🇹🇭 +66 (Thailand)' },
  { code: '+62', label: '🇮🇩 +62 (Indonesia)' },
  { code: '+49', label: '🇩🇪 +49 (Germany)' },
]

export function formatWhatsAppPhone(rawMobile: string): string {
  let cleaned = (rawMobile || '').trim()
  if (!cleaned) return ''

  if (cleaned.startsWith('+')) {
    return cleaned.replace(/\D/g, '')
  }

  const digits = cleaned.replace(/\D/g, '')
  if (digits.length > 10) return digits

  if (digits.length === 10) {
    if (
      digits.startsWith('65') ||
      digits.startsWith('971') ||
      digits.startsWith('44') ||
      digits.startsWith('60') ||
      digits.startsWith('61') ||
      digits.startsWith('62') ||
      digits.startsWith('49') ||
      digits.startsWith('33') ||
      digits.startsWith('81') ||
      digits.startsWith('86')
    ) {
      return digits
    }
    return '91' + digits
  }

  return digits
}

function PhoneInputWithPrefix({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  let initialPrefix = '+91'
  let initialDigits = value || ''

  if (value && value.trim().startsWith('+')) {
    const parts = value.trim().split(' ')
    if (parts.length > 1) {
      initialPrefix = parts[0]
      initialDigits = parts.slice(1).join('')
    } else {
      const match = COUNTRY_CODES.find(c => value.startsWith(c.code))
      if (match) {
        initialPrefix = match.code
        initialDigits = value.substring(match.code.length)
      } else {
        initialDigits = value.replace(/\D/g, '')
      }
    }
  } else if (value && value.length > 10) {
    const match = COUNTRY_CODES.find(c => value.replace(/\D/g, '').startsWith(c.code.replace('+', '')))
    if (match) {
      initialPrefix = match.code
      initialDigits = value.replace(/\D/g, '').substring(match.code.length - 1)
    }
  }

  const [prefix, setPrefix] = useState(initialPrefix)
  const [digits, setDigits] = useState(initialDigits)

  useEffect(() => {
    if (!value) {
      setDigits('')
      return
    }
    if (value.startsWith('+')) {
      const match = COUNTRY_CODES.find(c => value.startsWith(c.code))
      if (match) {
        setPrefix(match.code)
        setDigits(value.substring(match.code.length).trim())
      } else {
        setDigits(value)
      }
    } else {
      setDigits(value)
    }
  }, [value])

  const handlePrefixChange = (newPrefix: string) => {
    setPrefix(newPrefix)
    const clean = digits.trim()
    onChange(clean ? `${newPrefix} ${clean}` : newPrefix)
  }

  const handleDigitsChange = (newDigits: string) => {
    setDigits(newDigits)
    const clean = newDigits.trim()
    onChange(clean ? `${prefix} ${clean}` : '')
  }

  return (
    <div className="flex gap-1.5">
      <select
        value={prefix}
        onChange={e => handlePrefixChange(e.target.value)}
        className="bg-[#0A1931] border border-white/10 rounded-sm px-2 py-2 text-xs text-[#C9A84C] font-mono outline-none focus:border-[#C9A84C]/40"
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <input
        value={digits}
        onChange={e => handleDigitsChange(e.target.value)}
        placeholder="9876543210"
        className="flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40"
      />
    </div>
  )
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://khandelwalinvite.vercel.app'

type FoodPref = 'vegetarian' | 'jain' | 'non-vegetarian' | 'other' | ''
type LiquorPref = 'yes' | 'no' | 'maybe' | ''

interface PersonForm {
  first_name: string; last_name: string; nickname: string; mobile: string
  food_preference: FoodPref; liquor_preference: LiquorPref; invite_code: string
}
interface FormState {
  primary: PersonForm; spouse: PersonForm; has_spouse: boolean; send_together: boolean
  guest_of: string; relationship_group: string
}

const emptyPerson = (): PersonForm => ({
  first_name: '', last_name: '', nickname: '', mobile: '',
  food_preference: '', liquor_preference: '', invite_code: generateCode(),
})
const emptyForm = (): FormState => ({
  primary: emptyPerson(), spouse: { ...emptyPerson(), invite_code: generateCode() },
  has_spouse: false, send_together: true, guest_of: '', relationship_group: '',
})

function PrefBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 py-1.5 border rounded-sm text-[10px] transition-all ${active ? 'border-[#C9A84C]/70 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/10 text-white/40 hover:border-white/25'}`}>
      {label}
    </button>
  )
}

function PersonSection({ label, person, onChange }: { label: string; person: PersonForm; onChange: (p: PersonForm) => void }) {
  const set = (field: keyof PersonForm, val: string) => onChange({ ...person, [field]: val })
  return (
    <div className="border border-[#C9A84C]/10 rounded-sm p-4 flex flex-col gap-3">
      <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">First Name *</label>
          <input required value={person.first_name} onChange={e => set('first_name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Last Name</label>
          <input value={person.last_name} onChange={e => set('last_name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Nickname</label>
          <input value={person.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Home name"
            className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Mobile & Country Code</label>
          <PhoneInputWithPrefix value={person.mobile} onChange={val => set('mobile', val)} />
        </div>
      </div>
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Food</label>
        <div className="flex gap-1.5">
          {(['vegetarian', 'jain', 'non-vegetarian', 'other'] as FoodPref[]).map(opt => (
            <PrefBtn key={opt} label={opt === 'vegetarian' ? 'Veg' : opt === 'non-vegetarian' ? 'Non-Veg' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={person.food_preference === opt} onClick={() => set('food_preference', person.food_preference === opt ? '' : opt)} />
          ))}
        </div>
      </div>
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Drinks</label>
        <div className="flex gap-1.5">
          {(['yes', 'no', 'maybe'] as LiquorPref[]).map(opt => (
            <PrefBtn key={opt} label={opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={person.liquor_preference === opt} onClick={() => set('liquor_preference', person.liquor_preference === opt ? '' : opt)} />
          ))}
        </div>
      </div>
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invite Code</label>
        <div className="flex gap-2">
          <input value={person.invite_code} onChange={e => set('invite_code', e.target.value.toUpperCase())} maxLength={8}
            className="flex-1 bg-white/5 border border-[#C9A84C]/20 rounded-sm px-3 py-2 text-sm text-[#C9A84C] font-mono outline-none focus:border-[#C9A84C]/50" />
          <button type="button" onClick={() => set('invite_code', generateCode())} className="btn-outline px-3 py-2 text-xs">↻</button>
        </div>
        <p className="text-[9px] text-white/20 mt-1">{BASE_URL}/i/{person.invite_code}</p>
      </div>
    </div>
  )
}

const getStatusInfo = (status: string) => {
  const s = (status || '').toLowerCase()
  if (s === 'entered' || s === 'opened' || s === 'seen' || s === 'message_seen') {
    return { label: 'MESSAGE SEEN', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
  }
  return { label: 'MESSAGE SENT', color: 'text-white/40 bg-white/5 border-white/10' }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [editForm, setEditForm] = useState<Partial<Guest>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const [guestMap, setGuestMap] = useState<Record<string, { name: string; mobile: string }>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('guests').select('*').order('created_at', { ascending: false })
    if (data) {
      const map: Record<string, { name: string; mobile: string }> = {}
      data.forEach((g: Guest) => {
        map[g.id] = {
          name: `${g.first_name}${g.last_name ? ' ' + g.last_name : ''}`,
          mobile: g.mobile || ''
        }
      })

      for (const g of data) {
        if (g.linked_guest_id && map[g.linked_guest_id]) {
          const partner = map[g.linked_guest_id]
          const updates: Partial<Guest> = {}
          if (!g.partner_name && partner.name) updates.partner_name = partner.name
          if (!g.partner_mobile && partner.mobile) updates.partner_mobile = partner.mobile
          if (Object.keys(updates).length > 0) {
            if (updates.partner_name) g.partner_name = updates.partner_name
            if (updates.partner_mobile) g.partner_mobile = updates.partner_mobile
            await supabase.from('guests').update(updates).eq('id', g.id)
          }
        } else if (!g.linked_guest_id && g.partner_name) {
          const match = data.find(other =>
            other.id !== g.id &&
            `${other.first_name}${other.last_name ? ' ' + other.last_name : ''}`.toLowerCase() === g.partner_name?.toLowerCase()
          )
          if (match) {
            const myName = `${g.first_name}${g.last_name ? ' ' + g.last_name : ''}`
            await supabase.from('guests').update({
              linked_guest_id: match.id,
              partner_mobile: match.mobile || null
            }).eq('id', g.id)
            await supabase.from('guests').update({
              linked_guest_id: g.id,
              partner_name: myName,
              partner_mobile: g.mobile || null
            }).eq('id', match.id)
            g.linked_guest_id = match.id
            g.partner_mobile = match.mobile || g.partner_mobile
            match.linked_guest_id = g.id
            match.partner_name = myName
            match.partner_mobile = g.mobile || match.partner_mobile
          }
        }
      }

      setGuests([...data])
      setGuestMap(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) fetchGuests() }, [authed, fetchGuests])

  const handleLogin = () => {
    if (pass === ADMIN_PASS) setAuthed(true)
    else alert('Wrong password!')
  }

  // ── SAVE GUEST ──
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.primary.first_name.trim()) return alert('First name required')
    setSaving(true)
    try {
      const shared = { guest_of: form.guest_of.trim(), relationship_group: form.relationship_group }
      if (!form.has_spouse) {
        const { error } = await supabase.from('guests').insert({ ...shared, first_name: form.primary.first_name.trim(), last_name: form.primary.last_name.trim() || null, nickname: form.primary.nickname.trim() || null, mobile: form.primary.mobile.trim(), food_preference: form.primary.food_preference || null, liquor_preference: form.primary.liquor_preference || null, invite_code: form.primary.invite_code, invited_count: 1 })
        if (error) throw error
      } else {
        const partnerName = form.spouse.nickname.trim() || `${form.spouse.first_name.trim()}${form.spouse.last_name.trim() ? ' ' + form.spouse.last_name.trim() : ''}`
        const primaryName = form.primary.nickname.trim() || `${form.primary.first_name.trim()}${form.primary.last_name.trim() ? ' ' + form.primary.last_name.trim() : ''}`
        const isTogether = form.send_together

        const { data: p, error: e1 } = await supabase.from('guests').insert({
          ...shared,
          first_name: form.primary.first_name.trim(),
          last_name: form.primary.last_name.trim() || null,
          nickname: form.primary.nickname.trim() || null,
          mobile: form.primary.mobile.trim(),
          food_preference: form.primary.food_preference || null,
          liquor_preference: form.primary.liquor_preference || null,
          partner_name: partnerName,
          partner_mobile: form.spouse.mobile.trim() || null,
          invite_code: form.primary.invite_code,
          invited_count: isTogether ? 2 : 1,
          send_together: isTogether
        }).select().single()
        if (e1) throw e1

        const { data: s, error: e2 } = await supabase.from('guests').insert({
          ...shared,
          first_name: form.spouse.first_name.trim(),
          last_name: form.spouse.last_name.trim() || null,
          nickname: form.spouse.nickname.trim() || null,
          mobile: form.spouse.mobile.trim(),
          food_preference: form.spouse.food_preference || null,
          liquor_preference: form.spouse.liquor_preference || null,
          partner_name: primaryName,
          partner_mobile: form.primary.mobile.trim() || null,
          invite_code: form.spouse.invite_code,
          invited_count: 1,
          send_together: isTogether
        }).select().single()
        if (e2) throw e2

        if (p && s) {
          await supabase.from('guests').update({ linked_guest_id: s.id }).eq('id', p.id)
          await supabase.from('guests').update({ linked_guest_id: p.id }).eq('id', s.id)
        }
      }
      setForm(emptyForm()); setShowForm(false); fetchGuests()
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Unknown'))
    } finally { setSaving(false) }
  }

  // ── EDIT ──
  const startEdit = (g: Guest) => {
    setEditingGuest(g)
    setEditForm({ first_name: g.first_name, last_name: g.last_name || '', nickname: g.nickname || '', mobile: g.mobile || '', partner_name: g.partner_name || '', partner_mobile: g.partner_mobile || '', food_preference: g.food_preference || '', liquor_preference: g.liquor_preference || '', guest_of: g.guest_of || '', relationship_group: g.relationship_group || '', invite_code: g.invite_code, video_url: g.video_url || '' })
  }

  const handleEditSave = async () => {
    if (!editingGuest) return
    const payload: Record<string, any> = { ...editForm }
    if (payload.video_url === '') delete payload.video_url

    let { error } = await supabase.from('guests').update(payload).eq('id', editingGuest.id)

    if (error && (error.message?.includes('video_url') || error.message?.includes('schema cache'))) {
      delete payload.video_url
      const retry = await supabase.from('guests').update(payload).eq('id', editingGuest.id)
      error = retry.error
    }

    if (error) { alert('Error: ' + error.message); return }

    if (editingGuest.linked_guest_id) {
      const myFullName = `${editForm.first_name || ''}${editForm.last_name ? ' ' + editForm.last_name : ''}`.trim()
      await supabase.from('guests').update({
        partner_name: myFullName,
        partner_mobile: editForm.mobile || null
      }).eq('id', editingGuest.linked_guest_id)
    }

    setEditingGuest(null); fetchGuests()
  }

  // ── DELETE ──
  const deleteGuest = async (id: string) => {
    if (!confirm('Delete this guest?')) return
    await supabase.from('guests').delete().eq('id', id); fetchGuests()
  }

  // ── COPY LINK ──
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/i/${code}`)
    setCopied(code); setTimeout(() => setCopied(null), 2000)
  }

  // ── WHATSAPP ──
  const sendWhatsApp = (g: Guest) => {
    const link = `${BASE_URL}/i/${g.invite_code}`
    const isCouple = (g.send_together && !!g.partner_name) || (g.invited_count && g.invited_count > 1)

    function getName(nickname?: string, fullName?: string): string {
      if (nickname && nickname.trim()) return nickname.trim()
      if (!fullName || !fullName.trim()) return ''
      return fullName.trim().split(' ')[0]
    }

    const pDisplay = getName(g.nickname, g.first_name)
    const partDisplay = getName(undefined, g.partner_name)
    const name = (g.send_together && partDisplay) ? `${pDisplay} & ${partDisplay}` : pDisplay
    const youTarget = isCouple ? 'you both' : 'you'

    const msg = `\u2728 Four Decades. One Amazing Journey. And Now... One BIG Celebration! \u2728\n\nDear ${name}, \u2764\uFE0F\n\nIt gives me immense pleasure to personally invite ${youTarget} to celebrate my brother ARPIT’s 40th Birthday & Diwali Celebration!\n\n\uD83D\uDCC5 Friday, 23rd October 2026\n\uD83D\uDCCD Jaipur\n\n${name} \u2014 no excuses, no "we'll try", and definitely no last-minute plans! \uD83D\uDE1C\n\n\uD83D\uDC49 *Personal Digital Invitation:*\n${link}`

    const phone = formatWhatsAppPhone(g.mobile || '')
    const targetUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(targetUrl, '_blank')
  }

  // ── EXPORT CSV ──
  const exportCSV = () => {
    const headers = ['Name', 'Nickname', 'Mobile', 'Partner', 'Partner Mobile', 'Attendance', 'Food', 'Drinks', 'Invited By', 'Group', 'Status', 'Invite Code', 'Invite Link']
    const rows = guests.map(g => {
      const st = (g.invitation_status || '').toLowerCase()
      const attendance = (st === 'rsvp_yes' || st === 'attending' || st === 'yes') ? 'Attending' : (st === 'rsvp_no' || st === 'declined' || st === 'no') ? 'Declined' : 'Pending'
      return [
        `${g.first_name}${g.last_name ? ' ' + g.last_name : ''}`,
        g.nickname || '',
        g.mobile || '',
        g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || '',
        g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || '',
        attendance,
        g.food_preference || '',
        g.liquor_preference || '',
        g.guest_of || '',
        g.relationship_group || '',
        g.invitation_status,
        g.invite_code,
        `${BASE_URL}/i/${g.invite_code}`
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'arpit40_guests.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── IMPORT CSV ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImportMsg('Importing...')
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1)
    let count = 0
    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
      const [name, nickname, mobile, partner_name, partner_mobile, food_preference, liquor_preference, guest_of, relationship_group] = cols
      if (!name) continue
      const [first_name, ...rest] = name.split(' ')
      const last_name = rest.join(' ')
      const code = generateCode()
      await supabase.from('guests').insert({ first_name, last_name: last_name || null, nickname: nickname || null, mobile: mobile || null, partner_name: partner_name || null, partner_mobile: partner_mobile || null, food_preference: food_preference || null, liquor_preference: liquor_preference || null, guest_of: guest_of || null, relationship_group: relationship_group || null, invite_code: code, invited_count: partner_name ? 2 : 1 })
      count++
    }
    setImportMsg(`✅ ${count} guests imported!`)
    setTimeout(() => setImportMsg(''), 3000)
    fetchGuests()
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleTogether = async (g: Guest) => {
    const nowTogether = !g.send_together
    await supabase.from('guests').update({ send_together: nowTogether }).eq('id', g.id)
    fetchGuests()
  }

  const filtered = guests.filter(g => {
    const partnerName = g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || ''
    const partnerMob = g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || ''
    return `${g.first_name} ${g.last_name} ${partnerName} ${g.mobile} ${partnerMob} ${g.nickname}`.toLowerCase().includes(search.toLowerCase())
  })

  // Attendance stats counts
  const attendingCount = guests.filter(g => ['rsvp_yes', 'attending', 'yes'].includes((g.invitation_status || '').toLowerCase())).length
  const declinedCount = guests.filter(g => ['rsvp_no', 'declined', 'not_attending', 'no'].includes((g.invitation_status || '').toLowerCase())).length
  const messageSeenCount = guests.filter(g => ['opened', 'entered', 'seen', 'message_seen'].includes((g.invitation_status || '').toLowerCase())).length
  const messageSentCount = guests.filter(g => !g.invitation_status || ['pending', 'sent', 'message_sent'].includes((g.invitation_status || '').toLowerCase())).length

  // ── LOGIN ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#050D1A] flex items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/40 mb-3">Admin Access</p>
            <h1 className="font-serif text-2xl text-[#F5ECD7]">Arpit's 40th & Diwali Bash</h1>
          </div>
          <div className="glass rounded-sm p-6 flex flex-col gap-4">
            <input type="password" placeholder="Password" value={pass}
              onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="bg-transparent border-b border-[#C9A84C]/20 pb-2 text-[#F5ECD7] font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/50" />
            <button onClick={handleLogin} className="btn-primary py-3 text-sm tracking-widest uppercase">Enter</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050D1A] text-white font-sans pb-24 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[#C9A84C]/10 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="font-serif text-xl text-[#C9A84C]">Arpit's 40th & Diwali Bash</h1>
          <p className="text-[10px] tracking-widest uppercase text-white/30 mt-0.5">Guest Management</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-serif text-[#C9A84C]">{guests.length}</p>
          <p className="text-[10px] text-white/30 tracking-widest uppercase">Records</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 border-b border-[#C9A84C]/10">
        {[
          { label: 'Total', val: guests.length, color: 'text-[#C9A84C]' },
          { label: 'Message Sent', val: messageSentCount, color: 'text-white/50' },
          { label: 'Message Seen', val: messageSeenCount, color: 'text-yellow-400' },
          { label: 'Attending', val: attendingCount, color: 'text-green-400' },
          { label: 'Not Attending', val: declinedCount, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center border-r border-[#C9A84C]/10 last:border-0">
            <p className={`text-lg font-serif ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/30 tracking-widest uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 flex gap-2 items-center flex-wrap border-b border-[#C9A84C]/10">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          className="flex-1 min-w-[150px] bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#C9A84C]/40" />
        <button onClick={() => { setShowForm(true); setForm(emptyForm()) }}
          className="btn-primary px-4 py-2 text-sm tracking-wider whitespace-nowrap">+ Add Guest</button>
        <button onClick={exportCSV}
          className="btn-outline px-4 py-2 text-sm whitespace-nowrap">↓ Export CSV</button>
        <label className="btn-outline px-4 py-2 text-sm whitespace-nowrap cursor-pointer">
          ↑ Import CSV
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
        </label>
        <button onClick={fetchGuests} className="btn-outline px-3 py-2 text-sm">↻</button>
        {importMsg && <span className="text-[11px] text-green-400">{importMsg}</span>}
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#C9A84C]/10 text-[10px] uppercase tracking-widest text-white/30">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Nickname</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Partner</th>
              <th className="px-4 py-3 text-left">Partner Mob</th>
              <th className="px-4 py-3 text-left text-[#C9A84C]/90">Attendance</th>
              <th className="px-4 py-3 text-left">Food</th>
              <th className="px-4 py-3 text-left">Drinks</th>
              <th className="px-4 py-3 text-left">Via</th>
              <th className="px-4 py-3 text-left">Group</th>
              <th className="px-4 py-3 text-left">Msg Status</th>
              <th className="px-4 py-3 text-left">Send As</th>
              <th className="px-4 py-3 text-left">Video</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="px-4 py-16 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={15} className="px-4 py-16 text-center text-white/30">
                <p className="font-serif text-lg mb-1">No guests yet</p>
                <p className="text-xs">Click "+ Add Guest" to get started</p>
              </td></tr>
            ) : filtered.map(g => {
              const info = getStatusInfo(g.invitation_status)
              const st = (g.invitation_status || '').toLowerCase()
              const isYes = st === 'rsvp_yes' || st === 'attending' || st === 'yes'
              const isNo = st === 'rsvp_no' || st === 'declined' || st === 'not_attending' || st === 'no'

              return (
                <tr key={g.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-serif text-[#F5ECD7] whitespace-nowrap">
                    {g.first_name}{g.last_name ? ' ' + g.last_name : ''}
                  </td>
                  <td className="px-4 py-3 text-[#C9A84C]/60 italic text-xs">{g.nickname || '—'}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs whitespace-nowrap">{g.mobile || '—'}</td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || '—'}
                  </td>
                  <td className="px-4 py-3 text-white/40 font-mono text-xs whitespace-nowrap">
                    {g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || '—'}
                  </td>

                  {/* DEDICATED ATTENDANCE COLUMN */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isYes ? (
                      <span className="text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <span>🎉</span> Attending
                      </span>
                    ) : isNo ? (
                      <span className="text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <span>❌</span> Declined
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/35 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <span>⏳</span> Pending
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {g.food_preference ? (
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/50 capitalize whitespace-nowrap">
                        {g.food_preference === 'vegetarian' ? 'Veg' : g.food_preference === 'non-vegetarian' ? 'Non-Veg' : g.food_preference}
                      </span>
                    ) : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {g.liquor_preference ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${g.liquor_preference === 'yes' ? 'bg-amber-500/10 text-amber-400' : g.liquor_preference === 'no' ? 'bg-white/5 text-white/30' : 'bg-blue-500/10 text-blue-400'}`}>
                        🥂 {g.liquor_preference}
                      </span>
                    ) : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#C9A84C]/40 text-xs">{g.guest_of || '—'}</td>
                  <td className="px-4 py-3 text-white/40 text-xs capitalize">{g.relationship_group || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[9px] font-semibold px-2 py-0.5 border rounded-sm tracking-wider whitespace-nowrap ${info.color}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {g.linked_guest_id ? (
                      <button onClick={() => toggleTogether(g)} title={g.send_together ? 'Click to send separately' : 'Click to send together'}
                        className={`px-2 py-1 border rounded-sm text-[10px] whitespace-nowrap transition-all ${g.send_together ? 'border-[#C9A84C]/50 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/15 text-white/35 hover:border-[#C9A84C]/30'}`}>
                        {g.send_together ? '👫 Together' : '👤 Separate'}
                      </button>
                    ) : <span className="text-white/15 text-[10px]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {g.video_url ? (
                      <a href={g.video_url} target="_blank" rel="noreferrer" className="text-[#C9A84C] hover:underline flex items-center gap-1 text-[11px]">
                        🎬 Custom
                      </a>
                    ) : (
                      <span className="text-white/20 text-[10px]" title="Uses default video or /videos/video_<code.mp4>">
                        🌐 Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#C9A84C]/60">{g.invite_code}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => copyLink(g.invite_code)} title="Copy Card link (/i/code)"
                        className={`px-2 py-1 border rounded-sm text-[10px] transition-all whitespace-nowrap ${copied === g.invite_code ? 'border-green-500/40 text-green-400' : 'border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10'}`}>
                        {copied === g.invite_code ? '✓ Copied' : '📋 Copy Link'}
                      </button>
                      <button onClick={() => sendWhatsApp(g)} title="Send via WhatsApp"
                        className="px-2 py-1 border border-green-500/20 text-green-400/60 hover:text-green-400 rounded-sm text-[10px] transition-all whitespace-nowrap">
                        WA
                      </button>
                      <button onClick={() => window.open(`${BASE_URL}/i/${g.invite_code}`, '_blank')} title="Preview Full Invitation Card"
                        className="px-2 py-1 border border-white/10 text-white/30 hover:text-white/60 rounded-sm text-[10px] transition-all">
                        👁
                      </button>
                      <button onClick={() => startEdit(g)} title="Edit"
                        className="px-2 py-1 border border-[#C9A84C]/20 text-[#C9A84C]/50 hover:text-[#C9A84C] rounded-sm text-[10px] transition-all">
                        ✏️
                      </button>
                      <button onClick={() => deleteGuest(g.id)} title="Delete"
                        className="px-2 py-1 border border-red-500/10 text-red-400/30 hover:text-red-400 hover:border-red-500/30 rounded-sm text-[10px] transition-all">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ══ ADD GUEST MODAL ══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4">
          <div className="glass w-full max-w-lg mx-auto rounded-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-xl text-[#F5ECD7]">Add Guest</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <PersonSection label="Primary Guest" person={form.primary} onChange={p => setForm(f => ({ ...f, primary: p }))} />
              <button type="button" onClick={() => setForm(f => ({ ...f, has_spouse: !f.has_spouse }))}
                className={`w-full py-2.5 border rounded-sm text-xs tracking-widest uppercase transition-all ${form.has_spouse ? 'border-[#C9A84C]/40 text-[#C9A84C]' : 'border-white/10 text-white/40'}`}>
                {form.has_spouse ? '✓ Spouse Added' : '+ Add Spouse / Partner'}
              </button>
              {form.has_spouse && (
                <>
                  <PersonSection label="Spouse / Partner" person={form.spouse} onChange={p => setForm(f => ({ ...f, spouse: p }))} />
                  <div className="border border-[#C9A84C]/10 rounded-sm p-4">
                    <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60 mb-3">Invite Type</p>
                    <div className="flex flex-col gap-2">
                      {[{ val: true, label: 'Together — One Link', sub: `"${form.primary.first_name || 'Name'} & ${form.spouse.first_name || 'Partner'}"` }, { val: false, label: 'Separate — Two Links', sub: 'Each gets personal invite' }].map(opt => (
                        <button key={String(opt.val)} type="button" onClick={() => setForm(f => ({ ...f, send_together: opt.val }))}
                          className={`w-full py-2.5 px-4 border rounded-sm text-left transition-all ${form.send_together === opt.val ? 'border-[#C9A84C]/50 bg-[#C9A84C]/5' : 'border-white/10'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${form.send_together === opt.val ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-white/30'}`} />
                            <div><p className="text-sm text-[#F5ECD7]">{opt.label}</p><p className="text-[10px] text-white/30">{opt.sub}</p></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invited By</label>
                  <input value={form.guest_of} onChange={e => setForm(f => ({ ...f, guest_of: e.target.value }))} placeholder="Arpit / Vipul"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Group</label>
                  <select value={form.relationship_group} onChange={e => setForm(f => ({ ...f, relationship_group: e.target.value }))}
                    className="w-full bg-[#0A1931] border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none">
                    <option value="">Select</option>
                    <option value="family">Family</option>
                    <option value="friends">Friends</option>
                    <option value="business">Business</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-sm">
                  {saving ? 'Saving...' : form.has_spouse && !form.send_together ? 'Save 2 Guests' : 'Save Guest'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline px-6 py-3 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4">
          <div className="glass w-full max-w-lg mx-auto rounded-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-serif text-xl text-[#F5ECD7]">Edit — {editingGuest.first_name}</h2>
              <button onClick={() => setEditingGuest(null)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">First Name</label>
                  <input value={editForm.first_name || ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Last Name</label>
                  <input value={editForm.last_name || ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Nickname</label>
                  <input value={editForm.nickname || ''} onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Mobile & Country Code</label>
                  <PhoneInputWithPrefix value={editForm.mobile || ''} onChange={val => setEditForm(f => ({ ...f, mobile: val }))} />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Partner Name</label>
                  <input value={editForm.partner_name || ''} onChange={e => setEditForm(f => ({ ...f, partner_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Partner Mobile & Country Code</label>
                  <PhoneInputWithPrefix value={editForm.partner_mobile || ''} onChange={val => setEditForm(f => ({ ...f, partner_mobile: val }))} />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invited By</label>
                  <input value={editForm.guest_of || ''} onChange={e => setEditForm(f => ({ ...f, guest_of: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invite Code</label>
                  <input value={editForm.invite_code || ''} onChange={e => setEditForm(f => ({ ...f, invite_code: e.target.value.toUpperCase() }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40 font-mono text-[#C9A84C]" />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Food</label>
                <div className="flex gap-1.5">
                  {['vegetarian', 'jain', 'non-vegetarian', 'other'].map(opt => (
                    <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, food_preference: f.food_preference === opt ? '' : opt }))}
                      className={`flex-1 py-2 border rounded-sm text-[10px] transition-all ${editForm.food_preference === opt ? 'border-[#C9A84C]/70 text-[#C9A84C]' : 'border-white/10 text-white/40'}`}>
                      {opt === 'vegetarian' ? 'Veg' : opt === 'non-vegetarian' ? 'Non-Veg' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Drinks</label>
                <div className="flex gap-1.5">
                  {['yes', 'no', 'maybe'].map(opt => (
                    <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, liquor_preference: f.liquor_preference === opt ? '' : opt }))}
                      className={`flex-1 py-2 border rounded-sm text-[10px] transition-all ${editForm.liquor_preference === opt ? 'border-[#C9A84C]/70 text-[#C9A84C]' : 'border-white/10 text-white/40'}`}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest text-[#C9A84C]/80 block mb-1">Personalized Video URL</label>
                <input value={editForm.video_url || ''} onChange={e => setEditForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://... or /videos/video_code.mp4"
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                <p className="text-[9px] text-white/30 mt-1">Direct MP4 link (Supabase Storage, CDN, HeyGen, or /videos/filename.mp4)</p>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Group</label>
                <select value={editForm.relationship_group || ''} onChange={e => setEditForm(f => ({ ...f, relationship_group: e.target.value }))}
                  className="w-full bg-[#0A1931] border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none">
                  <option value="">Select</option>
                  <option value="family">Family</option>
                  <option value="friends">Friends</option>
                  <option value="business">Business</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 mt-1">
                <button onClick={handleEditSave} className="btn-primary flex-1 py-3 text-sm">Save Changes</button>
                <button onClick={() => setEditingGuest(null)} className="btn-outline px-6 py-3 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
