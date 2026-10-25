'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  supabase,
  Guest,
  parseGuestNotes,
  updateGuestInviteDetails,
  GuestInviteDetails,
  ActualAttendanceStatus,
  ThankYouDeliveryStatus,
} from '@/lib/supabase'
import ThankYouCampaignStudio from '@/components/ThankYouCampaignStudio'
import {
  buildThankYouWhatsAppMessage,
  resolveGuestDisplayName,
  resolveGuestAndPartnerNames,
  renderThankYouCardToCanvas,
  getThankYouCardFilename,
  resolveGuestThankYouTheme,
  ThankYouVariant,
  ThankYouTheme,
} from '@/lib/thankYouCard'

export function getEffectiveInviteDetails(g: Guest, allGuests: Guest[]): GuestInviteDetails {
  const own = parseGuestNotes(g.notes)
  let partnerDetails: GuestInviteDetails = {}
  if (g.linked_guest_id) {
    const partner = allGuests.find(p => p.id === g.linked_guest_id)
    if (partner) {
      partnerDetails = parseGuestNotes(partner.notes)
    }
  }

  // Template Type (Diwali vs 40 & Festive): own first, then partner default if couple together, then host default
  const host = (g.guest_of || '').toLowerCase().trim()
  const defaultType: 'diwali' | '40_festive' = (host === 'vipul' || host === 'jitu') ? 'diwali' : '40_festive'
  const defaultInstaType: '40_festive' | 'soiree' = (host === 'vipul' || host === 'jitu') ? 'soiree' : '40_festive'
  const std_type = own.std_type || (g.send_together ? partnerDetails.std_type : '') || defaultType
  const main_type = own.main_type || (g.send_together ? partnerDetails.main_type : '') || defaultType
  const insta_type = own.insta_type || (g.send_together ? partnerDetails.insta_type : '') || defaultInstaType

  // Message Status (pending / sent / seen): STRICTLY INDIVIDUAL TO THIS GUEST.
  // Never inherit partner's status!
  let std_status: 'pending' | 'sent' | 'seen' = own.std_status || 'pending'
  let main_status: 'pending' | 'sent' | 'seen' = own.main_status || 'pending'
  let insta_status: 'pending' | 'sent' | 'seen' = own.insta_status || 'pending'

  // If notes did not specify an explicit status yet, check this guest's own passive invitation_status (entered / sent)
  if (!own.std_status) {
    const rawSt = (g.invitation_status || '').toLowerCase()
    if (['seen', 'message_seen', 'entered', 'opened'].includes(rawSt)) {
      std_status = 'seen'
    } else if (['sent', 'message_sent'].includes(rawSt)) {
      std_status = 'sent'
    }
  }

  // Post-Event Thank-You Campaign fields
  let derivedFromPartner: ActualAttendanceStatus | undefined
  if (partnerDetails.attendance_status === 'attended_partner_missed') {
    derivedFromPartner = 'missed_partner_attended'
  } else if (partnerDetails.attendance_status === 'missed_partner_attended') {
    derivedFromPartner = 'attended_partner_missed'
  } else if (g.send_together) {
    derivedFromPartner = partnerDetails.attendance_status
  }

  const attendance_status: ActualAttendanceStatus =
    own.attendance_status || derivedFromPartner || 'unknown'

  const thank_you_type =
    own.thank_you_type ||
    (attendance_status === 'attended'
      ? 'attended'
      : attendance_status === 'did_not_attend'
      ? 'missed'
      : attendance_status === 'attended_partner_missed'
      ? 'attended_partner_missed'
      : attendance_status === 'missed_partner_attended'
      ? 'missed_partner_attended'
      : '')
  const thank_you_theme: ThankYouTheme =
    own.thank_you_theme ||
    (g.send_together && partnerDetails.thank_you_theme ? partnerDetails.thank_you_theme : undefined) ||
    resolveGuestThankYouTheme(g)
  const thank_you_status: ThankYouDeliveryStatus = own.thank_you_status || 'pending'
  const thank_you_sent_at = own.thank_you_sent_at || ''

  return {
    std_status,
    std_type,
    main_status,
    main_type,
    insta_status,
    insta_type,
    attendance_status,
    thank_you_type,
    thank_you_theme,
    thank_you_status,
    thank_you_sent_at,
  }
}

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'arpit40'

export interface PortalUser {
  id: string
  username: string
  password: string
  name: string
  role: 'super_admin' | 'user'
  created_at?: string
}

export type MessageTemplateMode =
  | 'invite'
  | 'save_date'
  | 'invite_diwali'
  | 'save_date_diwali'
  | 'location'
  | 'photos'
  | 'insta'
  | 'insta_soiree'
  | 'thankyou_attended'
  | 'thankyou_missed'
  | 'thankyou_attended_partner_missed'
  | 'thankyou_missed_partner_attended'
  | 'thankyou_soiree_attended'
  | 'thankyou_soiree_missed'
  | 'thankyou_soiree_attended_partner_missed'
  | 'thankyou_soiree_missed_partner_attended'

const DEFAULT_USERS: PortalUser[] = [
  { id: 'user-admin', username: 'admin', password: 'arpit40', name: 'Super Admin', role: 'super_admin', created_at: new Date().toISOString() },
  { id: 'user-arpit', username: 'arpit', password: 'arpit40', name: 'Arpit', role: 'user', created_at: new Date().toISOString() },
  { id: 'user-tanvi', username: 'tanvi', password: 'tanvi40', name: 'Tanvi', role: 'user', created_at: new Date().toISOString() },
  { id: 'user-vipul', username: 'vipul', password: 'vipul40', name: 'Vipul', role: 'user', created_at: new Date().toISOString() },
  { id: 'user-jitu', username: 'jitu', password: 'jitu40', name: 'Jitu', role: 'user', created_at: new Date().toISOString() },
]

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function getUniqueCode(usedCodes?: Set<string>): string {
  let code = generateCode()
  if (!usedCodes) return code
  let attempts = 0
  while (usedCodes.has(code.toUpperCase()) && attempts < 200) {
    code = generateCode()
    attempts++
  }
  usedCodes.add(code.toUpperCase())
  return code
}

const COUNTRY_CODES = [
  { code: '+91', label: '+91 (IN)' },
  { code: '+65', label: '+65 (SG)' },
  { code: '+971', label: '+971 (AE)' },
  { code: '+1', label: '+1 (US)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+60', label: '+60 (MY)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+66', label: '+66 (TH)' },
  { code: '+62', label: '+62 (ID)' },
  { code: '+49', label: '+49 (DE)' },
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
    <div className="flex gap-1.5 w-full min-w-0">
      <select
        value={prefix}
        onChange={e => handlePrefixChange(e.target.value)}
        className="w-24 shrink-0 min-w-0 bg-[#0A1931] border border-white/10 rounded-sm px-2 py-2 text-xs text-[#C9A84C] font-mono outline-none focus:border-[#C9A84C]/40"
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <input
        value={digits}
        onChange={e => handleDigitsChange(e.target.value)}
        placeholder="9876543210"
        className="flex-1 min-w-0 w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40 font-mono"
      />
    </div>
  )
}

const BASE_URL = typeof window !== 'undefined' && !window.location.origin.includes('localhost')
  ? window.location.origin
  : 'https://khandelwalinvite.vercel.app'

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
  if (
    s === 'entered' || s === 'opened' || s === 'seen' || s === 'message_seen' ||
    s === 'attending' || s === 'declined' || s === 'rsvp_yes' || s === 'rsvp_no' ||
    s === 'yes' || s === 'no'
  ) {
    return { label: 'MESSAGE SEEN', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
  }
  if (s === 'sent' || s === 'message_sent') {
    return { label: 'MESSAGE SENT', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
  }
  return { label: 'PENDING', color: 'text-white/30 bg-white/5 border-white/10' }
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null)
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>(DEFAULT_USERS)

  // Auth inputs
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')

  // Guest data & UI state
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [selectedHosts, setSelectedHosts] = useState<string[]>([])
  const [showHostFilterDropdown, setShowHostFilterDropdown] = useState(false)
  const hostFilterRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const [guestMap, setGuestMap] = useState<Record<string, { name: string; mobile: string }>>({})

  // Close host filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hostFilterRef.current && !hostFilterRef.current.contains(event.target as Node)) {
        setShowHostFilterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleHost = (hostKey: string) => {
    setSelectedHosts(prev => {
      if (prev.length === 0) {
        return [hostKey]
      }
      if (prev.includes(hostKey)) {
        return prev.filter(k => k !== hostKey)
      } else {
        return [...prev, hostKey]
      }
    })
  }

  // Form states
  const getExistingCodesSet = () => new Set<string>(guests.map(g => g.invite_code?.toUpperCase()).filter(Boolean))

  const emptyPerson = (usedSet?: Set<string>): PersonForm => {
    const used = usedSet || getExistingCodesSet()
    return {
      first_name: '', last_name: '', nickname: '', mobile: '',
      food_preference: '', liquor_preference: '', invite_code: getUniqueCode(used),
    }
  }

  const emptyForm = (): FormState => {
    const used = getExistingCodesSet()
    const primary = emptyPerson(used)
    const spouse = emptyPerson(used)
    return {
      primary, spouse,
      has_spouse: false, send_together: true,
      guest_of: currentUser ? (currentUser.role === 'super_admin' ? '' : currentUser.name) : '',
      relationship_group: '',
    }
  }

  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [editForm, setEditForm] = useState<Partial<Guest>>({})

  // New User Form State inside Users Modal
  const [newUserName, setNewUserName] = useState('')
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'super_admin' | 'user'>('user')
  const [userMsg, setUserMsg] = useState('')

  // Message Template & Custom Link States
  const [dashboardView, setDashboardView] = useState<'guests' | 'thank_you'>('guests')
  const [messageTemplate, setMessageTemplate] = useState<MessageTemplateMode>('invite')
  const [customLinks, setCustomLinks] = useState<{ locationUrl: string; photoUrl: string; instaUrl: string }>({
    locationUrl: 'https://maps.google.com/?q=Jaipur',
    photoUrl: '',
    instaUrl: 'https://instagram.com/'
  })
  const [showLinksModal, setShowLinksModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── LOAD PORTAL USERS, CURRENT USER & CUSTOM LINKS FROM LOCALSTORAGE ──
  useEffect(() => {
    const savedLinks = localStorage.getItem('portal_custom_links')
    if (savedLinks) {
      try { setCustomLinks(JSON.parse(savedLinks)) } catch {}
    }

    const mergeWithDefaults = (list: PortalUser[]): PortalUser[] => {
      const merged = [...list]
      for (const def of DEFAULT_USERS) {
        if (!merged.some(u => u.username.toLowerCase() === def.username.toLowerCase())) {
          merged.push(def)
        }
      }
      return merged
    }

    const loadUsers = () => {
      try {
        const saved = localStorage.getItem('portal_users')
        const merged = saved ? mergeWithDefaults(JSON.parse(saved)) : DEFAULT_USERS
        setPortalUsers(merged)
        localStorage.setItem('portal_users', JSON.stringify(merged))
      } catch {
        setPortalUsers(DEFAULT_USERS)
      }

      const activeUser = localStorage.getItem('portal_current_user')
      if (activeUser) {
        try { setCurrentUser(JSON.parse(activeUser)) } catch {}
      }
    }
    loadUsers()
  }, [])

  // Save users helper
  const savePortalUsers = async (updatedUsers: PortalUser[]) => {
    setPortalUsers(updatedUsers)
    try {
      localStorage.setItem('portal_users', JSON.stringify(updatedUsers))
    } catch {}
  }

  // ── FETCH GUESTS ──
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
        }
      }

      // Fetch RSVPs to sync status only if guest doesn't have an invitation_status yet
      const { data: rsvps } = await supabase.from('rsvps').select('*')
      if (rsvps && rsvps.length > 0) {
        for (const g of data) {
          if (!g.invitation_status || g.invitation_status === '' || g.invitation_status === 'not_sent') {
            const rsvp = rsvps.find((r: any) => r.guest_id === g.id && (r.status === 'attending' || r.status === 'declined'))
            if (rsvp && rsvp.status) {
              g.invitation_status = rsvp.status
            }
          }
        }
      }

      setGuests([...data])
      setGuestMap(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (currentUser) fetchGuests()
  }, [currentUser, fetchGuests])

  // ── LOGIN ──
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoginError('')

    const uInput = usernameInput.trim().toLowerCase()
    const pInput = passwordInput.trim().toLowerCase()

    // Combine current state with DEFAULT_USERS so all 5 accounts are always available
    const allUsers = [...portalUsers]
    for (const def of DEFAULT_USERS) {
      if (!allUsers.some(u => u.username.toLowerCase() === def.username.toLowerCase())) {
        allUsers.push(def)
      }
    }

    // 1. Try matching Username & Password (case-insensitive for mobile keyboards)
    let matched = allUsers.find(u =>
      (u.username.toLowerCase() === uInput || u.name.toLowerCase() === uInput) && u.password.toLowerCase() === pInput
    )

    // 2. Fallback: if only Password entered or matches Super Admin pass when username is empty/admin
    if (!matched && (!uInput || uInput === 'admin' || uInput === 'super admin') && pInput === ADMIN_PASS.toLowerCase()) {
      matched = allUsers.find(u => u.role === 'super_admin') || DEFAULT_USERS[0]
    }

    // 3. Fallback: match password alone against any user
    if (!matched && pInput) {
      matched = allUsers.find(u => u.password.toLowerCase() === pInput)
    }

    if (matched) {
      setCurrentUser(matched)
      localStorage.setItem('portal_current_user', JSON.stringify(matched))
      setUsernameInput('')
      setPasswordInput('')
    } else {
      setLoginError('Invalid Username or Password!')
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('portal_current_user')
  }

  // ── CREATE NEW PORTAL USER ──
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentUser?.role !== 'super_admin') {
      return alert('Only Super Admin can create new user accounts!')
    }
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
      return setUserMsg('Please fill all user fields!')
    }

    const cleanUsername = newUserUsername.trim().toLowerCase()
    if (portalUsers.some(u => u.username.toLowerCase() === cleanUsername)) {
      return setUserMsg('Username already exists! Choose another.')
    }

    const newUser: PortalUser = {
      id: 'user-' + Date.now(),
      name: newUserName.trim(),
      username: cleanUsername,
      password: newUserPassword.trim(),
      role: newUserRole,
      created_at: new Date().toISOString()
    }

    const updated = [...portalUsers, newUser]
    await savePortalUsers(updated)

    setNewUserName('')
    setNewUserUsername('')
    setNewUserPassword('')
    setNewUserRole('user')
    setUserMsg(`✅ User "${newUser.name}" created! Password: ${newUser.password}`)
    setTimeout(() => setUserMsg(''), 4000)
  }

  const handleDeleteUser = async (userId: string) => {
    if (currentUser?.role !== 'super_admin') return alert('Only Super Admin can delete user accounts!')
    if (userId === 'user-admin') return alert('Super Admin cannot be deleted!')
    if (!confirm('Delete this user account?')) return
    const updated = portalUsers.filter(u => u.id !== userId)
    await savePortalUsers(updated)
  }

  // ── SAVE GUEST ──
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.primary.first_name.trim()) return alert('First name required')
    setSaving(true)
    try {
      // Fetch latest codes from Supabase DB to prevent collisions across multiple sessions
      const { data: existingCodesData } = await supabase.from('guests').select('invite_code')
      const usedCodes = new Set<string>(
        (existingCodesData || []).map(r => r.invite_code?.toUpperCase()).filter(Boolean)
      )

      let primaryCode = (form.primary.invite_code || '').trim().toUpperCase()
      if (!primaryCode || usedCodes.has(primaryCode)) {
        primaryCode = getUniqueCode(usedCodes)
      } else {
        usedCodes.add(primaryCode)
      }

      const guestOfName = form.guest_of.trim() || (currentUser?.name || '')
      const shared = { guest_of: guestOfName, relationship_group: form.relationship_group }

      if (!form.has_spouse) {
        let insertErr: any = null
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase.from('guests').insert({
            ...shared,
            first_name: form.primary.first_name.trim(),
            last_name: form.primary.last_name.trim() || null,
            nickname: form.primary.nickname.trim() || null,
            mobile: form.primary.mobile.trim(),
            food_preference: form.primary.food_preference || null,
            liquor_preference: form.primary.liquor_preference || null,
            invite_code: primaryCode,
            invited_count: 1
          })
          if (!error) { insertErr = null; break }
          if (error.message?.includes('guests_invite_code_key') || error.code === '23505') {
            primaryCode = getUniqueCode(usedCodes)
            insertErr = error
          } else {
            throw error
          }
        }
        if (insertErr) throw insertErr
      } else {
        let spouseCode = (form.spouse.invite_code || '').trim().toUpperCase()
        if (!spouseCode || usedCodes.has(spouseCode) || spouseCode === primaryCode) {
          spouseCode = getUniqueCode(usedCodes)
        } else {
          usedCodes.add(spouseCode)
        }

        const partnerName = form.spouse.nickname.trim() || `${form.spouse.first_name.trim()}${form.spouse.last_name.trim() ? ' ' + form.spouse.last_name.trim() : ''}`
        const primaryName = form.primary.nickname.trim() || `${form.primary.first_name.trim()}${form.primary.last_name.trim() ? ' ' + form.primary.last_name.trim() : ''}`
        const isTogether = form.send_together

        let p: Guest | null = null
        let s: Guest | null = null

        // Insert primary guest with retry on code collision
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase.from('guests').insert({
            ...shared,
            first_name: form.primary.first_name.trim(),
            last_name: form.primary.last_name.trim() || null,
            nickname: form.primary.nickname.trim() || null,
            mobile: form.primary.mobile.trim(),
            food_preference: form.primary.food_preference || null,
            liquor_preference: form.primary.liquor_preference || null,
            partner_name: partnerName,
            partner_mobile: form.spouse.mobile.trim() || null,
            invite_code: primaryCode,
            invited_count: isTogether ? 2 : 1,
            send_together: isTogether
          }).select().single()

          if (!error && data) { p = data as Guest; break }
          if (error?.message?.includes('guests_invite_code_key') || error?.code === '23505') {
            primaryCode = getUniqueCode(usedCodes)
          } else {
            throw error
          }
        }

        if (!p) throw new Error('Could not insert primary guest')

        // Insert spouse guest with retry on code collision
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase.from('guests').insert({
            ...shared,
            first_name: form.spouse.first_name.trim(),
            last_name: form.spouse.last_name.trim() || null,
            nickname: form.spouse.nickname.trim() || null,
            mobile: form.spouse.mobile.trim(),
            food_preference: form.spouse.food_preference || null,
            liquor_preference: form.spouse.liquor_preference || null,
            partner_name: primaryName,
            partner_mobile: form.primary.mobile.trim() || null,
            invite_code: spouseCode,
            invited_count: 1,
            send_together: isTogether
          }).select().single()

          if (!error && data) { s = data as Guest; break }
          if (error?.message?.includes('guests_invite_code_key') || error?.code === '23505') {
            spouseCode = getUniqueCode(usedCodes)
          } else {
            throw error
          }
        }

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

  // ── QUICK CHANGE ATTENDANCE STATUS (Strictly individual per guest) ──
  const handleAttendanceChange = async (g: Guest, newStatus: string) => {
    const targetIds = [g.id]

    // 1. Optimistic UI update so the dropdown changes immediately without any lag
    setGuests(prev => prev.map(item => targetIds.includes(item.id) ? { ...item, invitation_status: newStatus } : item))

    // 2. Update guests table
    for (const tId of targetIds) {
      const { error: guestErr } = await supabase.from('guests').update({ invitation_status: newStatus }).eq('id', tId)
      if (guestErr) {
        alert('Error updating attendance: ' + guestErr.message)
        fetchGuests()
        return
      }
    }

    // 3. Sync rsvps table so online RSVPs remain 100% consistent
    const rsvpStatus = (newStatus === 'rsvp_yes' || newStatus === 'attending' || newStatus === 'yes')
      ? 'attending'
      : (newStatus === 'rsvp_no' || newStatus === 'declined' || newStatus === 'no')
      ? 'declined'
      : 'pending'

    try {
      // Sync rsvps table in background without blocking or refreshing the page
      for (const tId of targetIds) {
        const { data: existingRows } = await supabase
          .from('rsvps')
          .select('id')
          .eq('guest_id', tId)

        if (existingRows && existingRows.length > 0) {
          await supabase
            .from('rsvps')
            .update({
              status: rsvpStatus,
              number_attending: rsvpStatus === 'attending' ? (g.invited_count || 1) : 0,
              updated_at: new Date().toISOString()
            })
            .eq('guest_id', tId)
        } else if (rsvpStatus !== 'pending') {
          await supabase
            .from('rsvps')
            .insert({
              guest_id: tId,
              status: rsvpStatus,
              number_attending: rsvpStatus === 'attending' ? (g.invited_count || 1) : 0
            })
        }
      }
    } catch (e) {
      console.warn('Syncing rsvps table error:', e)
    }
  }

  // ── QUICK CHANGE ANY FIELD (FOOD, DRINKS, HOST, GROUP - Strictly individual per guest) ──
  const handleFieldChange = async (g: Guest, field: string, value: string) => {
    const payload: Record<string, any> = { [field]: value || null }
    // Optimistic UI update in-place without page refresh
    setGuests(prev => prev.map(item => item.id === g.id ? { ...item, ...payload } : item))
    const { error } = await supabase.from('guests').update(payload).eq('id', g.id)
    if (error) {
      alert(`Error updating ${field}: ` + error.message)
      fetchGuests()
    }
  }

  // ── QUICK CHANGE INVITE PHASE (SAVE THE DATE, MAIN INVITE & INSTAGRAM - TYPE & STATUS) ──
  const handleUpdateInvitePhase = async (
    g: Guest,
    phase: 'std' | 'main' | 'insta',
    field: 'type' | 'status',
    value: string
  ) => {
    // If updating template TYPE (Diwali vs 40 & Festive) and send_together is active, keep couple on same event template.
    // If updating message STATUS (pending/sent/seen), ONLY update this specific individual guest!
    const targetIds = (field === 'type' && g.linked_guest_id && g.send_together)
      ? [g.id, g.linked_guest_id]
      : [g.id]

    // 1. Optimistic UI update
    setGuests(prev => prev.map(item => {
      if (!targetIds.includes(item.id)) return item
      const curr = parseGuestNotes(item.notes)
      const updated: GuestInviteDetails = {
        ...curr,
        ...(phase === 'std'
          ? (field === 'type' ? { std_type: value as any } : { std_status: value as any })
          : phase === 'main'
          ? (field === 'type' ? { main_type: value as any } : { main_status: value as any })
          : (field === 'type' ? { insta_type: value as any } : { insta_status: value as any }))
      }
      return { ...item, notes: JSON.stringify(updated) }
    }))

    // 2. Persist in Supabase for all targets
    for (const tId of targetIds) {
      const targetGuest = guests.find(x => x.id === tId)
      const curr = parseGuestNotes(targetGuest?.notes)
      const updated: GuestInviteDetails = {
        ...curr,
        ...(phase === 'std'
          ? (field === 'type' ? { std_type: value as any } : { std_status: value as any })
          : phase === 'main'
          ? (field === 'type' ? { main_type: value as any } : { main_status: value as any })
          : (field === 'type' ? { insta_type: value as any } : { insta_status: value as any }))
      }
      await supabase.from('guests').update({ notes: JSON.stringify(updated) }).eq('id', tId)
    }
  }

  // ── UPDATE THANK-YOU CAMPAIGN DETAILS (ATTENDANCE, CARD TYPE, STATUS, SENT AT) ──
  const handleUpdateThankYouDetails = async (
    g: Guest,
    updates: Partial<GuestInviteDetails>,
    syncCouple = false
  ) => {
    const isSplitPartnerStatus =
      updates.attendance_status === 'attended_partner_missed' ||
      updates.attendance_status === 'missed_partner_attended'

    const mirrorPartnerUpdates: Partial<GuestInviteDetails> | null =
      isSplitPartnerStatus && g.linked_guest_id
        ? {
            attendance_status:
              updates.attendance_status === 'attended_partner_missed'
                ? 'missed_partner_attended'
                : 'attended_partner_missed',
            thank_you_type:
              updates.attendance_status === 'attended_partner_missed'
                ? 'missed_partner_attended'
                : 'attended_partner_missed',
            thank_you_status: 'ready',
          }
        : null

    const targetIds =
      !isSplitPartnerStatus && syncCouple && g.linked_guest_id && g.send_together
        ? [g.id, g.linked_guest_id]
        : [g.id]

    setGuests(prev =>
      prev.map(item => {
        if (targetIds.includes(item.id)) {
          const curr = parseGuestNotes(item.notes)
          const merged = { ...curr, ...updates }
          return { ...item, notes: JSON.stringify(merged) }
        }
        if (mirrorPartnerUpdates && g.linked_guest_id && item.id === g.linked_guest_id) {
          const curr = parseGuestNotes(item.notes)
          // Preserve partner's 'sent'/'seen' status if already sent
          const keepStatus =
            curr.thank_you_status === 'sent' || curr.thank_you_status === 'seen'
              ? curr.thank_you_status
              : 'ready'
          const merged = { ...curr, ...mirrorPartnerUpdates, thank_you_status: keepStatus }
          return { ...item, notes: JSON.stringify(merged) }
        }
        return item
      })
    )

    for (const tId of targetIds) {
      const targetGuest = guests.find(x => x.id === tId)
      const curr = parseGuestNotes(targetGuest?.notes)
      const merged = { ...curr, ...updates }
      await supabase.from('guests').update({ notes: JSON.stringify(merged) }).eq('id', tId)
    }

    if (mirrorPartnerUpdates && g.linked_guest_id) {
      const partnerGuest = guests.find(x => x.id === g.linked_guest_id)
      const curr = parseGuestNotes(partnerGuest?.notes)
      const keepStatus =
        curr.thank_you_status === 'sent' || curr.thank_you_status === 'seen'
          ? curr.thank_you_status
          : 'ready'
      const merged = { ...curr, ...mirrorPartnerUpdates, thank_you_status: keepStatus }
      await supabase
        .from('guests')
        .update({ notes: JSON.stringify(merged) })
        .eq('id', g.linked_guest_id)
    }
  }

  const handleBulkUpdateThankYouDetails = async (
    updatesList: Array<{ guest: Guest; updates: Partial<GuestInviteDetails> }>
  ) => {
    const idMap = new Map<string, Partial<GuestInviteDetails>>()
    updatesList.forEach(({ guest, updates }) => {
      idMap.set(guest.id, updates)
      if (guest.linked_guest_id && guest.send_together) {
        idMap.set(guest.linked_guest_id, updates)
      }
    })

    setGuests(prev =>
      prev.map(item => {
        const up = idMap.get(item.id)
        if (!up) return item
        const curr = parseGuestNotes(item.notes)
        return { ...item, notes: JSON.stringify({ ...curr, ...up }) }
      })
    )

    for (const [tId, up] of idMap.entries()) {
      const targetGuest = guests.find(x => x.id === tId)
      const curr = parseGuestNotes(targetGuest?.notes)
      await supabase.from('guests').update({ notes: JSON.stringify({ ...curr, ...up }) }).eq('id', tId)
    }
  }

  // ── GENERATE / COPY / DOWNLOAD 1080x1350 THANK YOU CARD DIRECTLY FROM MAIN TABLE ──
  const exportOrCopyThankYouCard = async (
    g: Guest,
    variant: ThankYouVariant,
    action: 'copy' | 'download',
    themeOverride?: ThankYouTheme
  ) => {
    try {
      const inviteDetails = getEffectiveInviteDetails(g, guests)
      const activeTheme: ThankYouTheme = themeOverride || inviteDetails.thank_you_theme || '40_festive'
      const displayName = resolveGuestDisplayName(g, guests, variant)
      const { partnerInlineRef } = resolveGuestAndPartnerNames(g, guests)
      const canvas = document.createElement('canvas')
      await renderThankYouCardToCanvas(canvas, variant, displayName, partnerInlineRef, activeTheme)
      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png', 1.0)
      )
      if (!blob) return
      if (action === 'download') {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = getThankYouCardFilename(variant, g.invite_code || g.id, activeTheme)
        a.click()
        URL.revokeObjectURL(url)
      } else if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      }
    } catch {
      // ignore clipboard errors
    }
  }

  // ── EDIT GUEST ──
  const startEdit = (g: Guest) => {
    setEditingGuest(g)
    setEditForm({ first_name: g.first_name, last_name: g.last_name || '', nickname: g.nickname || '', mobile: g.mobile || '', partner_name: g.partner_name || '', partner_mobile: g.partner_mobile || '', food_preference: g.food_preference || '', liquor_preference: g.liquor_preference || '', guest_of: g.guest_of || '', relationship_group: g.relationship_group || '', invite_code: g.invite_code, video_url: g.video_url || '', invitation_status: g.invitation_status || 'pending' })
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
    const linkUrl = messageTemplate === 'save_date_diwali'
      ? `${BASE_URL}/i/${code}?type=save_date_diwali`
      : messageTemplate === 'invite_diwali'
      ? `${BASE_URL}/i/${code}?type=main_diwali`
      : messageTemplate === 'save_date'
      ? `${BASE_URL}/i/${code}?type=save_date`
      : messageTemplate === 'insta_soiree'
      ? `${BASE_URL}/i/${code}?type=insta_soiree&v=2`
      : messageTemplate === 'insta'
      ? `${BASE_URL}/i/${code}?type=insta&v=2`
      : messageTemplate === 'thankyou_attended'
      ? `${BASE_URL}/i/${code}?type=thankyou_attended&v=2`
      : messageTemplate === 'thankyou_missed'
      ? `${BASE_URL}/i/${code}?type=thankyou_missed&v=2`
      : messageTemplate === 'thankyou_attended_partner_missed'
      ? `${BASE_URL}/i/${code}?type=thankyou_attended_partner_missed&v=2`
      : messageTemplate === 'thankyou_missed_partner_attended'
      ? `${BASE_URL}/i/${code}?type=thankyou_missed_partner_attended&v=2`
      : messageTemplate === 'thankyou_soiree_attended'
      ? `${BASE_URL}/i/${code}?type=thankyou_soiree_attended&v=2`
      : messageTemplate === 'thankyou_soiree_missed'
      ? `${BASE_URL}/i/${code}?type=thankyou_soiree_missed&v=2`
      : messageTemplate === 'thankyou_soiree_attended_partner_missed'
      ? `${BASE_URL}/i/${code}?type=thankyou_soiree_attended_partner_missed&v=2`
      : messageTemplate === 'thankyou_soiree_missed_partner_attended'
      ? `${BASE_URL}/i/${code}?type=thankyou_soiree_missed_partner_attended&v=2`
      : `${BASE_URL}/i/${code}?type=main`
    navigator.clipboard.writeText(linkUrl)
    setCopied(code); setTimeout(() => setCopied(null), 2000)
  }

  // ── WHATSAPP ──
  const sendWhatsApp = async (g: Guest, modeOverride?: MessageTemplateMode) => {
    const activeMode = modeOverride || messageTemplate

    const guestSt = (g.invitation_status || '').toLowerCase()
    const isYes = guestSt === 'rsvp_yes' || guestSt === 'attending' || guestSt === 'yes'
    const isNo = guestSt === 'rsvp_no' || guestSt === 'declined' || guestSt === 'not_attending' || guestSt === 'no'

    const mainInviteLink = isNo
      ? `${BASE_URL}/i/${g.invite_code}?type=main&v=2`
      : `${BASE_URL}/i/${g.invite_code}?type=main`
    const mainDiwaliInviteLink = isNo
      ? `${BASE_URL}/i/${g.invite_code}?type=main_diwali&v=2`
      : `${BASE_URL}/i/${g.invite_code}?type=main_diwali`
    const saveDateLink = `${BASE_URL}/i/${g.invite_code}?type=save_date`
    const saveDateDiwaliLink = `${BASE_URL}/i/${g.invite_code}?type=save_date_diwali`
    const instaLink = `${BASE_URL}/i/${g.invite_code}?type=insta&v=2`
    const instaSoireeLink = `${BASE_URL}/i/${g.invite_code}?type=insta_soiree&v=2`
    const thankYouAttendedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_attended&v=2`
    const thankYouMissedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_missed&v=2`
    const thankYouAttendedPartnerMissedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_attended_partner_missed&v=2`
    const thankYouMissedPartnerAttendedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_missed_partner_attended&v=2`
    const thankYouSoireeAttendedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_attended&v=2`
    const thankYouSoireeMissedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_missed&v=2`
    const thankYouSoireeAttendedPartnerMissedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_attended_partner_missed&v=2`
    const thankYouSoireeMissedPartnerAttendedLink = `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_missed_partner_attended&v=2`

    // Pre-warm the invite route & OG image on Vercel edge/lambda immediately (before DB calls)
    const warmLink = activeMode === 'save_date_diwali'
      ? saveDateDiwaliLink
      : activeMode === 'invite_diwali'
      ? mainDiwaliInviteLink
      : activeMode === 'save_date'
      ? saveDateLink
      : activeMode === 'insta_soiree'
      ? instaSoireeLink
      : activeMode === 'insta'
      ? instaLink
      : activeMode === 'thankyou_attended'
      ? thankYouAttendedLink
      : activeMode === 'thankyou_missed'
      ? thankYouMissedLink
      : activeMode === 'thankyou_attended_partner_missed'
      ? thankYouAttendedPartnerMissedLink
      : activeMode === 'thankyou_missed_partner_attended'
      ? thankYouMissedPartnerAttendedLink
      : activeMode === 'thankyou_soiree_attended'
      ? thankYouSoireeAttendedLink
      : activeMode === 'thankyou_soiree_missed'
      ? thankYouSoireeMissedLink
      : activeMode === 'thankyou_soiree_attended_partner_missed'
      ? thankYouSoireeAttendedPartnerMissedLink
      : activeMode === 'thankyou_soiree_missed_partner_attended'
      ? thankYouSoireeMissedPartnerAttendedLink
      : mainInviteLink
    fetch(warmLink, { mode: 'no-cors' }).catch(() => {})

    const currentSt = (g.invitation_status || '').toLowerCase()
    if (!currentSt || currentSt === 'pending' || currentSt === 'not_sent') {
      g.invitation_status = 'sent'
      setGuests(prev => prev.map(item => item.id === g.id ? { ...item, invitation_status: 'sent' } : item))
      supabase.from('guests').update({ invitation_status: 'sent' }).eq('id', g.id).then(() => {})
    }

    // Track which specific invite was sent in notes
    const inviteUpdates: Partial<GuestInviteDetails> = {}
    if (activeMode === 'save_date_diwali') {
      inviteUpdates.std_type = 'diwali'
      inviteUpdates.std_status = 'sent'
    } else if (activeMode === 'save_date') {
      inviteUpdates.std_type = '40_festive'
      inviteUpdates.std_status = 'sent'
    } else if (activeMode === 'invite_diwali') {
      inviteUpdates.main_type = 'diwali'
      inviteUpdates.main_status = 'sent'
    } else if (activeMode === 'invite') {
      inviteUpdates.main_type = '40_festive'
      inviteUpdates.main_status = 'sent'
    } else if (activeMode === 'insta_soiree') {
      inviteUpdates.insta_type = 'soiree'
      inviteUpdates.insta_status = 'sent'
    } else if (activeMode === 'insta') {
      inviteUpdates.insta_type = '40_festive'
      inviteUpdates.insta_status = 'sent'
    } else if (activeMode === 'thankyou_attended') {
      inviteUpdates.attendance_status = 'attended'
      inviteUpdates.thank_you_type = 'attended'
      inviteUpdates.thank_you_theme = '40_festive'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_missed') {
      inviteUpdates.attendance_status = 'did_not_attend'
      inviteUpdates.thank_you_type = 'missed'
      inviteUpdates.thank_you_theme = '40_festive'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_attended_partner_missed') {
      inviteUpdates.attendance_status = 'attended_partner_missed'
      inviteUpdates.thank_you_type = 'attended_partner_missed'
      inviteUpdates.thank_you_theme = '40_festive'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_missed_partner_attended') {
      inviteUpdates.attendance_status = 'missed_partner_attended'
      inviteUpdates.thank_you_type = 'missed_partner_attended'
      inviteUpdates.thank_you_theme = '40_festive'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_soiree_attended') {
      inviteUpdates.attendance_status = 'attended'
      inviteUpdates.thank_you_type = 'attended'
      inviteUpdates.thank_you_theme = 'soiree'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_soiree_missed') {
      inviteUpdates.attendance_status = 'did_not_attend'
      inviteUpdates.thank_you_type = 'missed'
      inviteUpdates.thank_you_theme = 'soiree'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_soiree_attended_partner_missed') {
      inviteUpdates.attendance_status = 'attended_partner_missed'
      inviteUpdates.thank_you_type = 'attended_partner_missed'
      inviteUpdates.thank_you_theme = 'soiree'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    } else if (activeMode === 'thankyou_soiree_missed_partner_attended') {
      inviteUpdates.attendance_status = 'missed_partner_attended'
      inviteUpdates.thank_you_type = 'missed_partner_attended'
      inviteUpdates.thank_you_theme = 'soiree'
      inviteUpdates.thank_you_status = 'sent'
      inviteUpdates.thank_you_sent_at = new Date().toISOString()
    }

    if (Object.keys(inviteUpdates).length > 0) {
      await updateGuestInviteDetails(g.id, inviteUpdates)
      setGuests(prev => prev.map(item => {
        if (item.id === g.id) {
          const curr = parseGuestNotes(item.notes)
          return { ...item, notes: JSON.stringify({ ...curr, ...inviteUpdates }) }
        }
        return item
      }))
    }

    const isCouple = (g.send_together && !!g.partner_name) || (g.invited_count && g.invited_count > 1)

    const pDisplay = (g.nickname && g.nickname.trim())
      ? g.nickname.trim()
      : (g.first_name || '').trim()

    let partDisplay = ''
    if (g.linked_guest_id) {
      const linkedPartner = guests.find(other => other.id === g.linked_guest_id)
      if (linkedPartner) {
        partDisplay = (linkedPartner.nickname && linkedPartner.nickname.trim())
          ? linkedPartner.nickname.trim()
          : (linkedPartner.first_name || '').trim()
      }
    }

    if (!partDisplay && g.partner_name) {
      const matched = guests.find(other =>
        `${other.first_name}${other.last_name ? ' ' + other.last_name : ''}`.toLowerCase() === g.partner_name?.toLowerCase() ||
        other.first_name.toLowerCase() === g.partner_name?.toLowerCase() ||
        (other.nickname && other.nickname.toLowerCase() === g.partner_name?.toLowerCase())
      )
      if (matched) {
        partDisplay = (matched.nickname && matched.nickname.trim())
          ? matched.nickname.trim()
          : (matched.first_name || '').trim()
      } else {
        partDisplay = g.partner_name.trim()
      }
    }

    const name = (g.send_together && partDisplay) ? `${pDisplay} & ${partDisplay}` : pDisplay
    const youTarget = isCouple ? 'you both' : 'you'

    const EMOJI = {
      sparkles: String.fromCodePoint(0x2728),
      heart: String.fromCodePoint(0x2764, 0xFE0F),
      calendar: String.fromCodePoint(0x1F4C5),
      pin: String.fromCodePoint(0x1F4CD),
      wink: String.fromCodePoint(0x1F61C),
      phone: String.fromCodePoint(0x1F4DE),
      gift: String.fromCodePoint(0x1F381),
      camera: String.fromCodePoint(0x1F4F8),
    }

    const clock = String.fromCodePoint(0x23F0)

    let msg = ''

    if (activeMode === 'save_date_diwali') {
      const headphones = String.fromCodePoint(0x1F3A7)
      const pointRight = String.fromCodePoint(0x1F449)
      msg = `${EMOJI.sparkles} *SAVE THE DATE* ${EMOJI.sparkles}\n\nDear *${name}*,\n\nGet ready for an unforgettable night of music, lights, and celebration! Mark your calendar for the *Khandelwal Diwali Bash*.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur, Rajasthan*\n${headphones} *Drinks · Dance · Celebration*\n\n${pointRight} ${saveDateDiwaliLink}\n\nWarmly,\n*The Khandelwal Family*`
    } else if (activeMode === 'invite_diwali') {
      // Diwali Main Invite: Sender is Khandelwal Family; adapts to RSVP status
      if (isYes) {
        msg = `Dear *${name}*,\n\nWe are truly delighted that you will be joining us for the *Khandelwal Diwali Celebration!* ✨\n\nThis evening is about cherishing friendships, sharing laughter, and creating memories under the glow of Diwali, and having you with us makes it complete.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\nWe cannot wait to celebrate together under the festive lights. Tap below anytime for your digital pass and venue directions:\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainDiwaliInviteLink}\n\nLooking forward to welcoming you!\n\nWarmly,\n*Khandelwal Family*`
      } else if (isNo) {
        msg = `Dear *${name}*,\n\nWe received your response regarding the *Khandelwal Diwali Celebration*, and our gathering will truly feel incomplete without you! ${EMOJI.sparkles}\n\nWe completely understand busy festive schedules, but our family earnestly requests you to reconsider and join us — even if for a short while to share festive cheer and dinner!\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\n${EMOJI.gift} *Your Personal Digital Invitation & Venue Details:*\n${mainDiwaliInviteLink}\n\nWe would love nothing more than celebrating with you! ${EMOJI.sparkles}\n\nWarmly,\n*Khandelwal Family*`
      } else {
        // Pending / Initial Invite
        msg = `Dear *${name}*,\n\nIt gives us immense joy to warmly invite you to the *Khandelwal Diwali Celebration* — an evening of lights, laughter, music, and togetherness. This evening is about cherishing friendships and creating memories under the glow of Diwali.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\nYour presence will make our celebration truly brighter. Please tap the link below to view your digital invitation and kindly confirm your presence:\n\nWe would be delighted to have you with us — because celebrations are brighter when shared.\n\n${EMOJI.gift} *Your Personal Digital Invitation & RSVP:*\n${mainDiwaliInviteLink}\n\nWarmly,\n*Khandelwal Family*`
      }
    } else if (activeMode === 'save_date') {
      msg = `${EMOJI.sparkles} *SAVE THE DATE!* ${EMOJI.sparkles}\n\nDear *${name}*, ${EMOJI.heart}\n\nPlease mark your calendar for *ARPIT’s 40th Birthday & Diwali Celebration!*\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\nDetailed formal invitation to follow soon. We can’t wait to celebrate this special evening with ${youTarget}! ${EMOJI.heart}\n\nWith lots of love,\n*Tanvi Khandelwal & Family*\n\n${EMOJI.gift} *Save The Date Link:*\n${saveDateLink}`
    } else if (activeMode === 'location') {
      const loc = (customLinks.locationUrl || 'https://maps.google.com/?q=Jaipur').trim()
      msg = `📍 *VENUE & LOCATION DETAILS* 📍\n\nDear *${name}*, ${EMOJI.heart}\n\nHere are the venue location details for *Arpit’s 40th & Diwali Bash*:\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\n🗺️ *Google Maps Location Link:*\n${loc}\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainInviteLink}\n\nSee ${youTarget} soon! ${EMOJI.heart}\n*Tanvi Khandelwal & Family*`
    } else if (activeMode === 'photos') {
      const pUrl = (customLinks.photoUrl || mainInviteLink).trim()
      const iUrl = (customLinks.instaUrl || 'https://instagram.com').trim()
      msg = `📸 *EVENT PHOTOS & INSTAGRAM LINK* 📸\n\nDear *${name}*, ${EMOJI.heart}\n\nThank you for making Arpit's 40th & Diwali Bash so special! Here are the event photos and Instagram link for ${youTarget}:\n\n🖼️ *Event Photo Gallery Link:*\n${pUrl}\n\n✨ *Instagram Reel / Story Link:*\n${iUrl}\n\n${EMOJI.gift} *Your Invitation Card:*\n${mainInviteLink}\n\nWith lots of love,\n*Tanvi Khandelwal & Family*`
    } else if (activeMode === 'insta_soiree') {
      msg = instaSoireeLink
    } else if (activeMode === 'insta') {
      msg = instaLink
    } else if (activeMode === 'thankyou_attended') {
      msg = thankYouAttendedLink
    } else if (activeMode === 'thankyou_missed') {
      msg = thankYouMissedLink
    } else if (activeMode === 'thankyou_attended_partner_missed') {
      msg = thankYouAttendedPartnerMissedLink
    } else if (activeMode === 'thankyou_missed_partner_attended') {
      msg = thankYouMissedPartnerAttendedLink
    } else if (activeMode === 'thankyou_soiree_attended') {
      msg = thankYouSoireeAttendedLink
    } else if (activeMode === 'thankyou_soiree_missed') {
      msg = thankYouSoireeMissedLink
    } else if (activeMode === 'thankyou_soiree_attended_partner_missed') {
      msg = thankYouSoireeAttendedPartnerMissedLink
    } else if (activeMode === 'thankyou_soiree_missed_partner_attended') {
      msg = thankYouSoireeMissedPartnerAttendedLink
    } else {
      // Default 'invite' (40 & Festive - Main Invite sent by Tanvi; adapts to RSVP status)
      if (isYes) {
        msg = `Dear *${name}*,\n\nWe are truly delighted that you will be joining us to celebrate *Arpit’s 40th Birthday & Diwali Celebration!* ✨\n\nYour presence will make this milestone truly unforgettable. We are so excited to celebrate an evening of warmth, music, festive cheer, and togetherness with you.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\nTap below anytime for your personal digital pass and venue directions:\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainInviteLink}\n\nLooking forward to welcoming you!\n\nWarmly,\n*Tanvi*`
      } else if (isNo) {
        msg = `Dear *${name}*,\n\nWe received your response regarding *Arpit’s 40th Birthday & Diwali Celebration*, and the evening will truly feel incomplete without you! ${EMOJI.heart}\n\nMilestones like this come once in a lifetime — we completely understand busy schedules, but we earnestly request you to reconsider and join us, even if just for a little while to raise a toast together!\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\n${EMOJI.gift} *Your Personal Digital Invitation & Venue Details:*\n${mainInviteLink}\n\nWe would be overjoyed to have you with us! ${EMOJI.sparkles}\n\nWarmly,\n*Tanvi*`
      } else {
        // Pending / Initial Invite
        msg = `Dear *${name}*,\n\nIt gives me immense joy to invite you to a once-in-a-lifetime celebration — *Arpit’s 40th birthday* combined with the *Festival of Lights*. This evening is about cherishing friendships, sharing laughter, and creating memories under the glow of Diwali.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${clock} *8:00 PM Onwards*\n${EMOJI.pin} *“The Foothills Villas”, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur*\n\nYour presence will make this milestone truly unforgettable. Please join us for an evening of warmth, music, festive cheer, and togetherness.\n\nWe would be delighted to have you with us — because celebrations are brighter when shared.\n\n${EMOJI.gift} *Your Personal Digital Invitation & RSVP:*\n${mainInviteLink}\n\nWarmly,\n*Tanvi*`
      }
    }

    // Phone resolution with intelligent fallbacks
    let rawPhone = g.mobile || ''
    if (!rawPhone.trim() && g.partner_mobile) {
      rawPhone = g.partner_mobile
    }
    if (!rawPhone.trim() && g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) {
      rawPhone = guestMap[g.linked_guest_id].mobile
    }
    const phone = formatWhatsAppPhone(rawPhone)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    let targetUrl = ''
    if (isMobile) {
      targetUrl = phone
        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`
    } else {
      targetUrl = phone
        ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
        : `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`
    }

    window.open(targetUrl, '_blank')
  }

  // ── EXPORT CSV ──
  const exportCSV = () => {
    const headers = [
      'Name', 'Nickname', 'Mobile', 'Partner', 'Partner Mobile',
      'RSVP Status', 'Actual Attendance', 'Thank You Card Type', 'Thank You Status', 'Thank You Sent At',
      'Food', 'Drinks', 'Invited By', 'Group',
      'Save The Date Type', 'Save The Date Status',
      'Main Invite Type', 'Main Invite Status',
      'Instagram Type', 'Instagram Status',
      'Invite Code', 'Save The Date Link', 'Main Invite Link', 'Instagram Link', 'Thank You Card Asset URL'
    ]
    const rows = visibleGuests.map(g => {
      const st = (g.invitation_status || '').toLowerCase()
      const attendance = (st === 'rsvp_yes' || st === 'attending' || st === 'yes') ? 'Attending' : (st === 'rsvp_no' || st === 'declined' || st === 'no') ? 'Declined' : 'Pending'
      const d = getEffectiveInviteDetails(g, guests)
      const actualAtt = d.attendance_status || 'unknown'
      const tyType = d.thank_you_type || ''
      const tyStatus = (d.thank_you_status || 'pending').toUpperCase()
      const tySentAt = d.thank_you_sent_at || ''
      const tyAssetUrl = tyType ? `${BASE_URL}/api/thank-you-card?code=${g.invite_code}&type=${tyType}` : ''
      const stdType = d.std_type === 'diwali' ? 'Diwali Party' : d.std_type === '40_festive' ? '40 & Festive' : 'None'
      const stdStatus = (d.std_status || 'pending').toUpperCase()
      const mainType = d.main_type === 'diwali' ? 'Diwali Party' : d.main_type === '40_festive' ? '40 & Festive' : 'None'
      const mainStatus = (d.main_status || 'pending').toUpperCase()
      const instaType = d.insta_type === 'soiree' ? 'The Festive Soirée' : '40 & Festive'
      const instaStatus = (d.insta_status || 'pending').toUpperCase()
      const stdLink = d.std_type === 'diwali' ? `${BASE_URL}/i/${g.invite_code}?type=save_date_diwali` : `${BASE_URL}/i/${g.invite_code}?type=save_date`
      const mainLink = d.main_type === 'diwali' ? `${BASE_URL}/i/${g.invite_code}?type=main_diwali` : `${BASE_URL}/i/${g.invite_code}`
      const instaLink = d.insta_type === 'soiree' ? `${BASE_URL}/i/${g.invite_code}?type=insta_soiree` : `${BASE_URL}/i/${g.invite_code}?type=insta`

      return [
        `${g.first_name}${g.last_name ? ' ' + g.last_name : ''}`,
        g.nickname || '',
        g.mobile || '',
        g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || '',
        g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || '',
        attendance,
        actualAtt,
        tyType,
        tyStatus,
        tySentAt,
        g.food_preference || '',
        g.liquor_preference || '',
        g.guest_of || '',
        g.relationship_group || '',
        stdType,
        stdStatus,
        mainType,
        mainStatus,
        instaType,
        instaStatus,
        g.invite_code,
        stdLink,
        mainLink,
        instaLink,
        tyAssetUrl
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${currentUser?.name || 'guests'}_list.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── IMPORT CSV ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImportMsg('Importing...')
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1)
    let count = 0
    const defaultHost = currentUser?.role === 'super_admin' ? 'Arpit' : (currentUser?.name || '')
    
    const { data: existingCodesData } = await supabase.from('guests').select('invite_code')
    const usedCodes = new Set<string>(
      (existingCodesData || []).map(r => r.invite_code?.toUpperCase()).filter(Boolean)
    )

    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
      const [name, nickname, mobile, partner_name, partner_mobile, food_preference, liquor_preference, guest_of, relationship_group] = cols
      if (!name) continue
      const [first_name, ...rest] = name.split(' ')
      const last_name = rest.join(' ')
      const code = getUniqueCode(usedCodes)
      await supabase.from('guests').insert({
        first_name,
        last_name: last_name || null,
        nickname: nickname || null,
        mobile: mobile || null,
        partner_name: partner_name || null,
        partner_mobile: partner_mobile || null,
        food_preference: food_preference || null,
        liquor_preference: liquor_preference || null,
        guest_of: guest_of || defaultHost,
        relationship_group: relationship_group || null,
        invite_code: code,
        invited_count: partner_name ? 2 : 1
      })
      count++
    }
    setImportMsg(`✅ ${count} guests imported!`)
    setTimeout(() => setImportMsg(''), 3000)
    fetchGuests()
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleTogether = async (g: Guest) => {
    const nowTogether = !g.send_together
    setGuests(prev => prev.map(item => item.id === g.id ? { ...item, send_together: nowTogether } : item))
    await supabase.from('guests').update({ send_together: nowTogether }).eq('id', g.id)
  }

  // ── DATA ISOLATION & FILTERING LOGIC ──
  // 1. Filter by User Privacy Role
  const roleFilteredGuests = guests.filter(g => {
    if (!currentUser) return false
    if (currentUser.role === 'super_admin') return true
    const hostName = (g.guest_of || '').toLowerCase().trim()
    const userName = currentUser.name.toLowerCase().trim()
    const uName = currentUser.username.toLowerCase().trim()
    return hostName === userName || hostName === uName || hostName.includes(userName) || userName.includes(hostName)
  })

  // 2. Filter by Selected Host Filter (Super Admin only - supports one or more hosts together)
  const hostSelectedGuests = roleFilteredGuests.filter(g => {
    if (currentUser?.role !== 'super_admin' || selectedHosts.length === 0) return true
    const gHost = (g.guest_of || 'Unassigned').trim().toLowerCase()
    return selectedHosts.includes(gHost)
  })

  // 3. Filter by Search Query
  const filtered = hostSelectedGuests.filter(g => {
    const partnerName = g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || ''
    const partnerMob = g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || ''
    const hostOf = g.guest_of || ''
    return `${g.first_name} ${g.last_name} ${partnerName} ${g.mobile} ${partnerMob} ${g.nickname} ${hostOf}`.toLowerCase().includes(search.toLowerCase())
  })

  const visibleGuests = filtered

  // Attendance & invite status stats counts for visible guests
  const pendingCount = visibleGuests.filter(g => !g.invitation_status || ['pending', 'not_sent'].includes((g.invitation_status || '').toLowerCase())).length
  const attendingCount = visibleGuests.filter(g => ['rsvp_yes', 'attending', 'yes'].includes((g.invitation_status || '').toLowerCase())).length
  const declinedCount = visibleGuests.filter(g => ['rsvp_no', 'declined', 'not_attending', 'no'].includes((g.invitation_status || '').toLowerCase())).length

  // Save The Date stats (Sent / Seen / Types)
  const stdSentCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).std_status === 'sent').length
  const stdSeenCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).std_status === 'seen').length
  const stdDiwaliCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).std_type === 'diwali').length
  const std40Count = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).std_type === '40_festive').length

  // Main Invite stats (Sent / Seen / Types)
  const mainSentCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).main_status === 'sent').length
  const mainSeenCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).main_status === 'seen').length
  const mainDiwaliCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).main_type === 'diwali').length
  const main40Count = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).main_type === '40_festive').length

  // Instagram stats (Sent / Seen)
  const instaSentCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).insta_status === 'sent').length
  const instaSeenCount = visibleGuests.filter(g => getEffectiveInviteDetails(g, guests).insta_status === 'seen').length

  // Post-Event Thank-You Campaign stats
  const tyAttendedCount = visibleGuests.filter(g => {
    const st = getEffectiveInviteDetails(g, guests).attendance_status
    return st === 'attended' || st === 'attended_partner_missed'
  }).length
  const tyMissedCount = visibleGuests.filter(g => {
    const st = getEffectiveInviteDetails(g, guests).attendance_status
    return st === 'did_not_attend' || st === 'missed_partner_attended'
  }).length
  const tySentCount = visibleGuests.filter(g => {
    const st = getEffectiveInviteDetails(g, guests).thank_you_status
    return st === 'sent' || st === 'delivered' || st === 'seen'
  }).length

  // Canonical list of distinct hosts with case-insensitive grouping & counts
  const hostStats = useMemo(() => {
    const map = new Map<string, { key: string; displayName: string; count: number }>()
    roleFilteredGuests.forEach(g => {
      const raw = (g.guest_of || 'Unassigned').trim()
      const lower = raw.toLowerCase()
      if (!map.has(lower)) {
        map.set(lower, { key: lower, displayName: raw, count: 1 })
      } else {
        const item = map.get(lower)!
        item.count++
        if (raw !== raw.toUpperCase() && item.displayName === item.displayName.toUpperCase()) {
          item.displayName = raw
        }
      }
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [roleFilteredGuests])

  // ── LOGIN SCREEN ──
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050D1A] flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/60 mb-2">Portal Access</p>
            <h1 className="font-serif text-2xl text-[#F5ECD7]">Arpit's 40th & Diwali Bash</h1>
            <p className="text-xs text-white/30 mt-1">Guest Management Portal</p>
          </div>
          <form onSubmit={handleLogin} className="glass rounded-sm p-6 flex flex-col gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#C9A84C]/80 block mb-1">Username / Name</label>
              <input
                type="text"
                placeholder="e.g. admin, tanvi, vipul, arpit"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-[#F5ECD7] font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#C9A84C]/80 block mb-1">Password</label>
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-[#F5ECD7] font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/50"
              />
            </div>

            {loginError && <p className="text-xs text-red-400 font-medium">{loginError}</p>}

            <button type="submit" className="btn-primary py-3 text-xs tracking-widest uppercase mt-2">
              Log In to Portal
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050D1A] text-white font-sans pb-24 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[#C9A84C]/10 px-6 py-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl text-[#C9A84C]">Arpit's 40th & Diwali Bash</h1>
            <span className={`text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${currentUser.role === 'super_admin' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
              {currentUser.role === 'super_admin' ? '👑 Super Admin' : '👤 Host User'}
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5">
            Logged in as <strong className="text-[#F5ECD7] font-semibold">{currentUser.name}</strong> ({currentUser.username})
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-[#0A1931] border border-[#C9A84C]/40 rounded-sm p-1 gap-1">
            <button
              type="button"
              onClick={() => setDashboardView('guests')}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                dashboardView === 'guests'
                  ? 'bg-[#C9A84C] text-[#050D1A] font-bold shadow'
                  : 'text-[#F5ECD7]/70 hover:text-white'
              }`}
            >
              📋 Guest &amp; Invite Management
            </button>
            <button
              type="button"
              onClick={() => setDashboardView('thank_you')}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                dashboardView === 'thank_you'
                  ? 'bg-gradient-to-r from-[#2C1B11] via-[#C9A84C] to-[#E8D5A3] text-[#050D1A] font-bold shadow ring-1 ring-[#FFF8E1]'
                  : 'text-[#E8D5A3] hover:bg-white/5'
              }`}
            >
              <span>✨</span>
              <span>Post-Event Thank-You Campaign</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-[#E8D5A3] font-mono">
                {tyAttendedCount + tyMissedCount} verified · {tySentCount} sent
              </span>
            </button>
          </div>

          {currentUser.role === 'super_admin' && (
            <button
              onClick={() => setShowUsersModal(true)}
              className="btn-outline px-3.5 py-1.5 text-xs flex items-center gap-1.5 border-[#C9A84C]/40 text-[#C9A84C]"
            >
              <span>👥</span> Portal Users ({portalUsers.length})
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-sm text-xs transition-all"
          >
            Logout ➔
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 border-b border-[#C9A84C]/10 bg-[#050D1A]/50">
        <div className="px-4 py-3 text-center border-r border-b lg:border-b-0 border-[#C9A84C]/10">
          <p className="text-xl font-serif text-[#C9A84C]">{visibleGuests.length}</p>
          <p className="text-[9px] text-white/40 tracking-widest uppercase">Total Guests</p>
          <p className="text-[10px] text-white/30 mt-0.5">{guests.length !== visibleGuests.length ? `(${guests.length} in DB)` : 'Complete List'}</p>
        </div>

        <div className="px-4 py-3 text-center border-r border-b lg:border-b-0 border-[#C9A84C]/10 bg-amber-500/5">
          <p className="text-xl font-serif text-amber-300 font-bold">{stdSeenCount + stdSentCount}</p>
          <p className="text-[9px] text-amber-400/80 tracking-widest uppercase font-semibold">🗓️ Save The Date</p>
          <p className="text-[10px] text-white/50 mt-0.5">
            <span className="text-yellow-400 font-semibold">{stdSeenCount} Seen</span> · <span className="text-blue-400">{stdSentCount} Sent</span>
          </p>
        </div>

        <div className="px-4 py-3 text-center border-r border-b lg:border-b-0 border-[#C9A84C]/10 bg-amber-500/5">
          <p className="text-sm font-serif text-[#F5ECD7] font-semibold flex items-center justify-center gap-2 mt-1">
            <span>🪔 {stdDiwaliCount}</span>
            <span className="text-white/20">|</span>
            <span>🎂 {std40Count}</span>
          </p>
          <p className="text-[9px] text-amber-400/80 tracking-widest uppercase font-semibold mt-1">STD Breakdown</p>
          <p className="text-[10px] text-white/40 mt-0.5">Diwali vs 40 &amp; Festive</p>
        </div>

        <div className="px-4 py-3 text-center border-r border-b md:border-b-0 border-[#C9A84C]/10 bg-yellow-500/5">
          <p className="text-xl font-serif text-yellow-300 font-bold">{mainSeenCount + mainSentCount}</p>
          <p className="text-[9px] text-yellow-400/80 tracking-widest uppercase font-semibold">💌 Main Invite</p>
          <p className="text-[10px] text-white/50 mt-0.5">
            <span className="text-yellow-400 font-semibold">{mainSeenCount} Seen</span> · <span className="text-blue-400">{mainSentCount} Sent</span>
          </p>
        </div>

        <div className="px-4 py-3 text-center border-r border-b md:border-b-0 border-[#C9A84C]/10 bg-yellow-500/5">
          <p className="text-sm font-serif text-[#F5ECD7] font-semibold flex items-center justify-center gap-2 mt-1">
            <span>🪔 {mainDiwaliCount}</span>
            <span className="text-white/20">|</span>
            <span>🎂 {main40Count}</span>
          </p>
          <p className="text-[9px] text-yellow-400/80 tracking-widest uppercase font-semibold mt-1">Main Breakdown</p>
          <p className="text-[10px] text-white/40 mt-0.5">Diwali vs 40 &amp; Festive</p>
        </div>

        <div className="px-4 py-3 text-center border-r border-b md:border-b-0 border-[#C9A84C]/10 bg-pink-500/5">
          <p className="text-xl font-serif text-pink-300 font-bold">{instaSeenCount + instaSentCount}</p>
          <p className="text-[9px] text-pink-400/80 tracking-widest uppercase font-semibold">📸 Instagram</p>
          <p className="text-[10px] text-white/50 mt-0.5">
            <span className="text-yellow-400 font-semibold">{instaSeenCount} Seen</span> · <span className="text-blue-400">{instaSentCount} Sent</span>
          </p>
        </div>

        <div
          onClick={() => setDashboardView('thank_you')}
          className="px-4 py-3 text-center border-r border-b md:border-b-0 border-[#C9A84C]/20 bg-[#C9A84C]/10 cursor-pointer hover:bg-[#C9A84C]/15 transition-colors"
          title="Click to open Post-Event Thank-You Campaign Studio"
        >
          <p className="text-xl font-serif text-[#E8D5A3] font-bold">{tySentCount}</p>
          <p className="text-[9px] text-[#C9A84C] tracking-widest uppercase font-semibold">✨ Thank You</p>
          <p className="text-[10px] text-white/60 mt-0.5">
            <span className="text-emerald-400 font-semibold">🟫 {tyAttendedCount}</span> · <span className="text-amber-300 font-semibold">🥂 {tyMissedCount}</span>
          </p>
        </div>

        <div className="px-4 py-3 text-center last:border-0">
          <p className="text-xl font-serif text-green-400 font-bold">{attendingCount}</p>
          <p className="text-[9px] text-green-400 tracking-widest uppercase font-semibold">Attending (RSVP)</p>
          <p className="text-[10px] text-white/50 mt-0.5">
            <span className="text-red-400">{declinedCount} No</span> · <span className="text-white/40">{pendingCount} Awaiting</span>
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 flex gap-2 items-center flex-wrap border-b border-[#C9A84C]/10">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests by name, mobile, host..."
          className="flex-1 min-w-[150px] bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#C9A84C]/40" />

        {/* Super Admin Multi-Host Filter */}
        {currentUser.role === 'super_admin' && (
          <div className="relative" ref={hostFilterRef}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-[#C9A84C]/70 hidden sm:inline">Filter Host:</span>
              <button
                type="button"
                onClick={() => setShowHostFilterDropdown(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium border transition-all ${
                  selectedHosts.length > 0
                    ? 'bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5ECD7] shadow-sm shadow-[#C9A84C]/20'
                    : 'bg-[#0A1931] border-[#C9A84C]/40 text-[#C9A84C] hover:border-[#C9A84C]'
                }`}
                title="Choose one or more hosts together"
              >
                {selectedHosts.length === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span>🌟</span>
                    <span>All Hosts</span>
                    <span className="text-[10px] opacity-75 font-mono">({roleFilteredGuests.length})</span>
                  </span>
                ) : selectedHosts.length === 1 ? (
                  <span className="flex items-center gap-1.5">
                    <span>👤</span>
                    <span>{hostStats.find(h => h.key === selectedHosts[0])?.displayName || selectedHosts[0]}</span>
                    <span className="text-[10px] opacity-75 font-mono">({hostSelectedGuests.length})</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>👥</span>
                    <span>
                      {selectedHosts.length === hostStats.length
                        ? 'All Hosts'
                        : `${selectedHosts.length} Hosts Selected`}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono">({hostSelectedGuests.length})</span>
                  </span>
                )}

                <span className={`text-[8px] text-[#C9A84C] transition-transform duration-200 ${showHostFilterDropdown ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {selectedHosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedHosts([])}
                  className="px-1.5 py-1 text-[10px] rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  title="Reset to All Hosts"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Popover */}
            {showHostFilterDropdown && (
              <div className="absolute left-0 mt-1.5 w-64 bg-[#0A1931] border border-[#C9A84C]/40 rounded shadow-2xl z-50 p-2.5 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C9A84C]">
                    Select Hosts {selectedHosts.length > 0 ? `(${selectedHosts.length}/${hostStats.length})` : '(All)'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHosts([])}
                      className="text-[10px] text-[#C9A84C] hover:underline"
                    >
                      All
                    </button>
                    <span className="text-white/20 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedHosts(hostStats.map(h => h.key))}
                      className="text-[10px] text-white/60 hover:text-white hover:underline"
                    >
                      Check All
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                  {/* All Hosts option */}
                  <div
                    onClick={() => setSelectedHosts([])}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedHosts.length === 0}
                        onChange={() => setSelectedHosts([])}
                        className="accent-[#C9A84C] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span className="font-semibold text-amber-200">🌟 All Hosts</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">({roleFilteredGuests.length})</span>
                  </div>

                  <div className="h-px bg-white/10 my-1" />

                  {/* Individual Hosts */}
                  {hostStats.map(h => {
                    const isChecked = selectedHosts.includes(h.key)
                    return (
                      <div
                        key={h.key}
                        onClick={() => toggleHost(h.key)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                          isChecked ? 'bg-[#C9A84C]/15 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="accent-[#C9A84C] w-3.5 h-3.5 rounded cursor-pointer pointer-events-none"
                          />
                          <span className="flex items-center gap-1.5">
                            <span>👤</span>
                            <span>{h.displayName}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40 font-mono">({h.count})</span>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                  <span>Showing {hostSelectedGuests.length} guests</span>
                  <button
                    type="button"
                    onClick={() => setShowHostFilterDropdown(false)}
                    className="px-2.5 py-1 bg-[#C9A84C] text-[#050D1A] font-bold rounded text-[11px] hover:bg-[#d8b556] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={() => { setShowForm(true); setForm(emptyForm()) }}
          className="btn-primary px-4 py-2 text-sm tracking-wider whitespace-nowrap">+ Add Guest</button>
        {currentUser.role === 'super_admin' && (
          <button onClick={() => setShowUsersModal(true)}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-4 py-2 text-sm rounded-sm whitespace-nowrap font-medium flex items-center gap-1.5 transition-all">
            <span>👥</span> + Add User / Manage Users
          </button>
        )}
        <button onClick={exportCSV}
          className="btn-outline px-4 py-2 text-sm whitespace-nowrap">↓ Export CSV</button>
        <label className="btn-outline px-4 py-2 text-sm whitespace-nowrap cursor-pointer">
          ↑ Import CSV
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
        </label>
        <button onClick={fetchGuests} className="btn-outline px-3 py-2 text-sm">↻</button>
        {importMsg && <span className="text-[11px] text-green-400">{importMsg}</span>}
      </div>

      {/* ── ACTIVE INVITE SELECTION BAR ── */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#071326] via-[#0D1F3D] to-[#071326] border-b border-[#C9A84C]/25 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-serif font-bold uppercase tracking-widest text-[#C9A84C] flex items-center gap-1.5">
            <span className="text-sm">✉️</span> Active Invite To Send:
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded bg-black/40 border border-[#C9A84C]/30 font-medium text-white/90">
            {messageTemplate === 'save_date' && '🗓️ 40 & Festive — Save The Date'}
            {messageTemplate === 'invite' && '💌 40 & Festive — Main Invite (Sender: Tanvi • Auto RSVP)'}
            {messageTemplate === 'save_date_diwali' && '✨ Diwali Party — Save The Date'}
            {messageTemplate === 'invite_diwali' && '🎉 Diwali Party — Main Invite (Sender: Khandelwal Family • Auto RSVP)'}
            {messageTemplate === 'insta' && '🎂 Instagram — 40 & Festive (@40andfestive)'}
            {messageTemplate === 'insta_soiree' && '🪔 Instagram — The Festive Soirée (@40andfestive)'}
            {messageTemplate === 'thankyou_attended' && '🎂🟫 Thank You (40 & Festive) — Card A (Attended · Dark Walnut)'}
            {messageTemplate === 'thankyou_missed' && '🎂🥂 Thank You (40 & Festive) — Card B (Missed · Champagne)'}
            {messageTemplate === 'thankyou_attended_partner_missed' && '🎂🟫🥂 Thank You (40 & Festive) — Card C (Guest Came, Partner Missed)'}
            {messageTemplate === 'thankyou_missed_partner_attended' && '🎂🥂🟫 Thank You (40 & Festive) — Card D (Guest Missed, Partner Came)'}
            {messageTemplate === 'thankyou_soiree_attended' && '🪔🟫 Thank You (The Festive Soirée) — Card A (Attended · Dark Walnut)'}
            {messageTemplate === 'thankyou_soiree_missed' && '🪔🥂 Thank You (The Festive Soirée) — Card B (Missed · Champagne)'}
            {messageTemplate === 'thankyou_soiree_attended_partner_missed' && '🪔🟫🥂 Thank You (The Festive Soirée) — Card C (Guest Came, Partner Missed)'}
            {messageTemplate === 'thankyou_soiree_missed_partner_attended' && '🪔🥂🟫 Thank You (The Festive Soirée) — Card D (Guest Missed, Partner Came)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 40 & Festive */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-amber-500/30 gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 px-1.5">
              🎂 40 &amp; Festive:
            </span>
            <button
              onClick={() => setMessageTemplate('save_date')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'save_date'
                  ? 'bg-[#C9A84C] text-[#050D1A] font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-amber-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Save The Date for Arpit's 40th Birthday & Diwali Bash"
            >
              🗓️ Save The Date
            </button>
            <button
              onClick={() => setMessageTemplate('invite')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'invite'
                  ? 'bg-[#C9A84C] text-[#050D1A] font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-amber-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Main Invite for Arpit's 40th Birthday & Diwali Bash"
            >
              💌 Main Invite
            </button>
          </div>

          {/* Diwali Party */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-orange-500/30 gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 px-1.5">
              🪔 Diwali Party:
            </span>
            <button
              onClick={() => setMessageTemplate('save_date_diwali')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'save_date_diwali'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#050D1A] font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-orange-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Save The Date for Diwali Party (Arpit, Vipul & Jitu)"
            >
              ✨ Save The Date
            </button>
            <button
              onClick={() => setMessageTemplate('invite_diwali')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'invite_diwali'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#050D1A] font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-orange-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Main Invite for Diwali Party (Arpit, Vipul & Jitu)"
            >
              🎉 Main Invite
            </button>
          </div>

          {/* Instagram */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-pink-500/30 gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300 px-1.5">
              📸 Instagram:
            </span>
            <button
              onClick={() => setMessageTemplate('insta')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'insta'
                  ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-amber-500 text-white font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-pink-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Dedicated @40andfestive Instagram Page (40 & Festive branding)"
            >
              🎂 40 &amp; Festive
            </button>
            <button
              onClick={() => setMessageTemplate('insta_soiree')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'insta_soiree'
                  ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-amber-500 text-white font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-pink-100/70 hover:text-white hover:bg-white/5'
              }`}
              title="Dedicated @40andfestive Instagram Page (The Festive Soirée branding)"
            >
              🪔 The Festive Soirée
            </button>
          </div>

          {/* Post-Event Thank-You Campaign (40 & Festive) */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-[#C9A84C]/45 gap-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8D5A3] px-1.5">
              🎂✨ Thank You (40 &amp; Festive):
            </span>
            <button
              onClick={() => setMessageTemplate('thankyou_attended')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_attended'
                  ? 'bg-[#2C1B11] text-[#FFF5E0] font-bold shadow-md ring-1 ring-[#C9A84C]'
                  : 'text-[#E8D5A3]/75 hover:text-white hover:bg-white/5'
              }`}
              title="40 & FESTIVE · Card A — Both/Guest Attended (Dark Walnut Edition)"
            >
              🟫 Attended
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_missed')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_missed'
                  ? 'bg-[#F4E8D1] text-[#2E1C0E] font-bold shadow-md ring-1 ring-[#FFF8E1]'
                  : 'text-[#F4E8D1]/75 hover:text-white hover:bg-white/5'
              }`}
              title="40 & FESTIVE · Card B — Could Not Attend (Champagne Edition)"
            >
              🥂 Missed
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_attended_partner_missed')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_attended_partner_missed'
                  ? 'bg-[#2C1B11] text-[#FFF5E0] font-bold shadow-md ring-1 ring-emerald-400'
                  : 'text-emerald-200/80 hover:text-white hover:bg-white/5'
              }`}
              title="40 & FESTIVE · Card C — Guest Attended, Partner Missed"
            >
              🟫🥂 Came (Partner Missed)
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_missed_partner_attended')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_missed_partner_attended'
                  ? 'bg-[#F4E8D1] text-[#2E1C0E] font-bold shadow-md ring-1 ring-amber-400'
                  : 'text-amber-200/80 hover:text-white hover:bg-white/5'
              }`}
              title="40 & FESTIVE · Card D — Guest Missed, Partner Attended"
            >
              🥂🟫 Missed (Partner Came)
            </button>
          </div>

          {/* Post-Event Thank-You Campaign (The Festive Soirée) */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-orange-500/45 gap-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 px-1.5">
              🪔✨ Thank You (Festive Soirée):
            </span>
            <button
              onClick={() => setMessageTemplate('thankyou_soiree_attended')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_soiree_attended'
                  ? 'bg-[#2C1B11] text-[#FFF5E0] font-bold shadow-md ring-1 ring-orange-400'
                  : 'text-orange-200/75 hover:text-white hover:bg-white/5'
              }`}
              title="THE FESTIVE SOIRÉE · Card A — Both/Guest Attended (Dark Walnut Edition)"
            >
              🟫 Attended
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_soiree_missed')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_soiree_missed'
                  ? 'bg-[#F4E8D1] text-[#2E1C0E] font-bold shadow-md ring-1 ring-orange-300'
                  : 'text-[#F4E8D1]/75 hover:text-white hover:bg-white/5'
              }`}
              title="THE FESTIVE SOIRÉE · Card B — Could Not Attend (Champagne Edition)"
            >
              🥂 Missed
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_soiree_attended_partner_missed')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_soiree_attended_partner_missed'
                  ? 'bg-[#2C1B11] text-[#FFF5E0] font-bold shadow-md ring-1 ring-emerald-400'
                  : 'text-emerald-200/80 hover:text-white hover:bg-white/5'
              }`}
              title="THE FESTIVE SOIRÉE · Card C — Guest Attended, Partner Missed"
            >
              🟫🥂 Came (Partner Missed)
            </button>
            <button
              onClick={() => setMessageTemplate('thankyou_soiree_missed_partner_attended')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'thankyou_soiree_missed_partner_attended'
                  ? 'bg-[#F4E8D1] text-[#2E1C0E] font-bold shadow-md ring-1 ring-amber-400'
                  : 'text-amber-200/80 hover:text-white hover:bg-white/5'
              }`}
              title="THE FESTIVE SOIRÉE · Card D — Guest Missed, Partner Attended"
            >
              🥂🟫 Missed (Partner Came)
            </button>
            <button
              onClick={() => setDashboardView(dashboardView === 'thank_you' ? 'guests' : 'thank_you')}
              className="px-2.5 py-1 text-xs font-bold rounded bg-[#C9A84C]/20 text-[#E8D5A3] border border-[#C9A84C]/40 hover:bg-[#C9A84C]/30 transition-all cursor-pointer"
              title="Open the full 40 & FESTIVE + THE FESTIVE SOIRÉE Thank-You Campaign Studio"
            >
              {dashboardView === 'thank_you' ? '← Back to Table' : '🎨 Open Studio'}
            </button>
          </div>
        </div>
      </div>

      {dashboardView === 'thank_you' ? (
        <ThankYouCampaignStudio
          guests={visibleGuests}
          allGuests={guests}
          guestMap={guestMap}
          baseUrl={BASE_URL}
          formatWhatsAppPhone={formatWhatsAppPhone}
          onUpdateGuestDetails={handleUpdateThankYouDetails}
          onBulkUpdateGuestDetails={handleBulkUpdateThankYouDetails}
        />
      ) : (
      /* ── TABLE ── */
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#C9A84C]/10 text-[10px] uppercase tracking-widest text-white/30">
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-2 py-3 text-left">Nickname</th>
              <th className="px-3 py-3 text-left">Mobile</th>
              <th className="px-3 py-3 text-left">Partner</th>
              <th className="px-3 py-3 text-left">Partner Mob</th>
              <th className="px-3 py-3 text-left text-[#C9A84C]/90">Attendance</th>
              <th className="px-2 py-3 text-left">Food</th>
              <th className="px-2 py-3 text-left">Drinks</th>
              <th className="px-3 py-3 text-left">Host</th>
              <th className="px-2 py-3 text-left">Group</th>
              <th className="px-3 py-3 text-left text-[#E8D5A3] font-semibold bg-[#C9A84C]/10 border-l border-[#C9A84C]/30">✨ Thank You</th>
              <th className="px-3 py-3 text-left text-amber-300 font-semibold bg-amber-500/5 border-l border-amber-500/20">🗓️ Save The Date</th>
              <th className="px-3 py-3 text-left text-yellow-300 font-semibold bg-yellow-500/5 border-l border-yellow-500/20">💌 Main Invite</th>
              <th className="px-3 py-3 text-left text-pink-300 font-semibold bg-pink-500/5 border-l border-pink-500/20">📸 Instagram</th>
              <th className="px-2 py-3 text-left border-l border-white/5">Send As</th>
              <th className="px-2 py-3 text-left">Code</th>
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && guests.length === 0 ? (
              <tr><td colSpan={17} className="px-4 py-16 text-center text-white/30">Loading...</td></tr>
            ) : visibleGuests.length === 0 ? (
              <tr><td colSpan={17} className="px-4 py-16 text-center text-white/30">
                <p className="font-serif text-lg mb-1">No guests found</p>
                <p className="text-xs">Click "+ Add Guest" to add your guests</p>
              </td></tr>
            ) : visibleGuests.map(g => {
              const st = (g.invitation_status || '').toLowerCase()
              const isYes = st === 'rsvp_yes' || st === 'attending' || st === 'yes'
              const isNo = st === 'rsvp_no' || st === 'declined' || st === 'not_attending' || st === 'no'
              const inviteDetails = getEffectiveInviteDetails(g, guests)

              return (
                <tr key={g.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-3 font-serif text-[#F5ECD7] whitespace-nowrap">
                    {g.first_name}{g.last_name ? ' ' + g.last_name : ''}
                  </td>
                  <td className="px-2 py-3 text-[#C9A84C]/60 italic text-xs">{g.nickname || '—'}</td>
                  
                  {/* MOBILE COLUMN (With fallback to partner mobile) */}
                  <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                    {g.mobile && g.mobile.trim() ? (
                      <span className="text-white/70">{g.mobile}</span>
                    ) : g.partner_mobile && g.partner_mobile.trim() ? (
                      <span className="text-amber-400/80" title="Primary mobile empty; will send via partner mobile">
                        {g.partner_mobile} <span className="text-[9px] text-white/30 italic">(partner)</span>
                      </span>
                    ) : g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile ? (
                      <span className="text-amber-400/80" title="Primary mobile empty; will send via partner mobile">
                        {guestMap[g.linked_guest_id].mobile} <span className="text-[9px] text-white/30 italic">(partner)</span>
                      </span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-white/50 whitespace-nowrap">
                    {g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || '—'}
                  </td>
                  <td className="px-3 py-3 text-white/40 font-mono text-xs whitespace-nowrap">
                    {g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || '—'}
                  </td>

                  {/* ATTENDANCE COLUMN */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <select
                      value={isYes ? 'rsvp_yes' : isNo ? 'rsvp_no' : 'pending'}
                      onChange={(e) => handleAttendanceChange(g, e.target.value)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full outline-none cursor-pointer transition-all border ${
                        isYes
                          ? 'bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30'
                          : isNo
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                          : 'bg-white/5 text-amber-300/80 border-white/15 hover:border-[#C9A84C]/50'
                      }`}
                    >
                      <option value="pending" className="bg-[#0A1931] text-white/80">⏳ Pending</option>
                      <option value="rsvp_yes" className="bg-[#0A1931] text-green-400 font-semibold">🎉 Attending</option>
                      <option value="rsvp_no" className="bg-[#0A1931] text-red-400 font-semibold">❌ Declined</option>
                    </select>
                  </td>

                  {/* FOOD COLUMN */}
                  <td className="px-2 py-3 whitespace-nowrap">
                    <select
                      value={(g.food_preference || '').toLowerCase()}
                      onChange={(e) => handleFieldChange(g, 'food_preference', e.target.value)}
                      className="bg-white/5 border border-white/10 text-white/80 text-[11px] px-2 py-1 rounded-full outline-none cursor-pointer hover:border-[#C9A84C]/40 transition-all font-sans"
                    >
                      <option value="" className="bg-[#0A1931] text-white/40">— None</option>
                      <option value="vegetarian" className="bg-[#0A1931] text-green-400 font-medium">🥗 Veg</option>
                      <option value="jain" className="bg-[#0A1931] text-amber-300 font-medium">🥦 Jain</option>
                      <option value="non-vegetarian" className="bg-[#0A1931] text-red-400 font-medium">🍗 Non-Veg</option>
                      <option value="other" className="bg-[#0A1931] text-blue-300 font-medium">🍽️ Other</option>
                    </select>
                  </td>

                  {/* DRINKS COLUMN */}
                  <td className="px-2 py-3 whitespace-nowrap">
                    <select
                      value={(g.liquor_preference || '').toLowerCase()}
                      onChange={(e) => handleFieldChange(g, 'liquor_preference', e.target.value)}
                      className="bg-white/5 border border-white/10 text-white/80 text-[11px] px-2 py-1 rounded-full outline-none cursor-pointer hover:border-[#C9A84C]/40 transition-all font-sans"
                    >
                      <option value="" className="bg-[#0A1931] text-white/40">— None</option>
                      <option value="yes" className="bg-[#0A1931] text-amber-400 font-medium">🥂 Yes</option>
                      <option value="no" className="bg-[#0A1931] text-white/50 font-medium">🥤 No</option>
                      <option value="maybe" className="bg-[#0A1931] text-blue-400 font-medium">🍸 Maybe</option>
                    </select>
                  </td>

                  {/* INVITED BY (HOST) COLUMN */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <select
                      value={g.guest_of || ''}
                      onChange={(e) => handleFieldChange(g, 'guest_of', e.target.value)}
                      className="bg-[#0A1931] border border-[#C9A84C]/30 text-[#C9A84C] font-semibold text-xs px-2.5 py-1 rounded outline-none cursor-pointer hover:border-[#C9A84C]"
                    >
                      {portalUsers.map(u => (
                        <option key={u.id} value={u.name} className="bg-[#0A1931] text-[#C9A84C]">👤 {u.name}</option>
                      ))}
                      {!portalUsers.some(u => u.name === g.guest_of) && g.guest_of && (
                        <option value={g.guest_of} className="bg-[#0A1931] text-[#C9A84C]">👤 {g.guest_of}</option>
                      )}
                    </select>
                  </td>

                  {/* GROUP COLUMN */}
                  <td className="px-2 py-3 whitespace-nowrap">
                    {(() => {
                      const rawGrp = (g.relationship_group || '').trim()
                      const options = ['Family', 'Friends', 'Relatives', 'Business', 'VIP', 'Work', 'School', 'College']
                      const matchedOpt = options.find(o => o.toLowerCase() === rawGrp.toLowerCase()) || rawGrp
                      return (
                        <select
                          value={matchedOpt}
                          onChange={(e) => handleFieldChange(g, 'relationship_group', e.target.value)}
                          className="bg-white/5 border border-white/10 text-white/80 text-xs px-2 py-1 rounded outline-none cursor-pointer hover:border-[#C9A84C]/40 capitalize font-medium"
                        >
                          <option value="" className="bg-[#0A1931] text-white/40">— None</option>
                          {options.map(opt => (
                            <option key={opt} value={opt} className="bg-[#0A1931] text-white">{opt}</option>
                          ))}
                          {rawGrp && !options.some(o => o.toLowerCase() === rawGrp.toLowerCase()) && (
                            <option value={rawGrp} className="bg-[#0A1931] text-white">{rawGrp}</option>
                          )}
                        </select>
                      )
                    })()}
                  </td>

                  {/* ── THANK YOU COLUMN (THEME + ATTENDED / MISSED / SPLIT PARTNER + WA + PNG + STATUS) ── */}
                  <td className="px-3 py-2 whitespace-nowrap bg-[#C9A84C]/5 border-l border-[#C9A84C]/30">
                    <div className="flex flex-col gap-1 min-w-[215px]">
                      {/* Row 1: Theme selector (40 & Festive vs The Festive Soirée) + Quick WA + Download PNG */}
                      <div className="flex items-center gap-1">
                        <select
                          value={inviteDetails.thank_you_theme || '40_festive'}
                          onChange={(e) =>
                            handleUpdateThankYouDetails(g, {
                              thank_you_theme: e.target.value as ThankYouTheme,
                            })
                          }
                          className="flex-1 bg-[#0A1931] border border-[#C9A84C]/40 text-[#E8D5A3] text-[10px] font-semibold px-1.5 py-0.5 rounded outline-none cursor-pointer hover:border-[#C9A84C]"
                          title="Select Thank-You Card Theme (40 & Festive vs The Festive Soirée)"
                        >
                          <option value="40_festive" className="bg-[#0A1931] text-[#E8D5A3]">🎂 40 &amp; Festive</option>
                          <option value="soiree" className="bg-[#0A1931] text-amber-300">🪔 The Festive Soirée</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const isSoiree = inviteDetails.thank_you_theme === 'soiree'
                            const mode: MessageTemplateMode =
                              inviteDetails.attendance_status === 'attended_partner_missed'
                                ? isSoiree
                                  ? 'thankyou_soiree_attended_partner_missed'
                                  : 'thankyou_attended_partner_missed'
                                : inviteDetails.attendance_status === 'missed_partner_attended'
                                ? isSoiree
                                  ? 'thankyou_soiree_missed_partner_attended'
                                  : 'thankyou_missed_partner_attended'
                                : inviteDetails.attendance_status === 'did_not_attend'
                                ? isSoiree
                                  ? 'thankyou_soiree_missed'
                                  : 'thankyou_missed'
                                : isSoiree
                                ? 'thankyou_soiree_attended'
                                : 'thankyou_attended'
                            sendWhatsApp(g, mode)
                          }}
                          title={`Send ${inviteDetails.thank_you_theme === 'soiree' ? 'The Festive Soirée' : '40 & Festive'} Thank-You Note via WhatsApp`}
                          className="px-1.5 py-0.5 border border-green-500/40 text-green-400 hover:bg-green-500/20 rounded text-[9px] font-bold transition-all whitespace-nowrap cursor-pointer"
                        >
                          💬 WA
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            exportOrCopyThankYouCard(
                              g,
                              inviteDetails.attendance_status === 'attended_partner_missed'
                                ? 'attended_partner_missed'
                                : inviteDetails.attendance_status === 'missed_partner_attended'
                                ? 'missed_partner_attended'
                                : inviteDetails.attendance_status === 'did_not_attend'
                                ? 'missed'
                                : 'attended',
                              'download',
                              inviteDetails.thank_you_theme || '40_festive'
                            )
                          }
                          title={`Download 1080×1350 ${inviteDetails.thank_you_theme === 'soiree' ? 'The Festive Soirée' : '40 & Festive'} Thank-You Card PNG`}
                          className="px-1.5 py-0.5 border border-[#C9A84C]/40 text-[#E8D5A3] hover:bg-[#C9A84C]/20 rounded text-[9px] font-bold transition-all whitespace-nowrap cursor-pointer"
                        >
                          ⬇️
                        </button>
                      </div>

                      {/* Row 2: Card Variant selector + Status dropdown */}
                      <div className="flex items-center gap-1">
                        <select
                          value={inviteDetails.attendance_status || 'unknown'}
                          onChange={(e) => {
                            const val = e.target.value as ActualAttendanceStatus
                            handleUpdateThankYouDetails(g, {
                              attendance_status: val,
                              thank_you_type:
                                val === 'attended'
                                  ? 'attended'
                                  : val === 'did_not_attend'
                                  ? 'missed'
                                  : val === 'attended_partner_missed'
                                  ? 'attended_partner_missed'
                                  : val === 'missed_partner_attended'
                                  ? 'missed_partner_attended'
                                  : undefined,
                              thank_you_status:
                                val === 'unknown'
                                  ? 'pending'
                                  : inviteDetails.thank_you_status === 'sent' ||
                                    inviteDetails.thank_you_status === 'seen'
                                  ? inviteDetails.thank_you_status
                                  : 'ready',
                            })
                          }}
                          className={`flex-1 bg-[#0A1931] border text-[9px] font-semibold px-1.5 py-0.5 rounded outline-none cursor-pointer ${
                            inviteDetails.attendance_status === 'attended' ||
                            inviteDetails.attendance_status === 'attended_partner_missed'
                              ? 'border-emerald-500/50 text-emerald-300'
                              : inviteDetails.attendance_status === 'did_not_attend' ||
                                inviteDetails.attendance_status === 'missed_partner_attended'
                              ? 'border-amber-400/50 text-[#F4ECE1]'
                              : 'border-[#C9A84C]/40 text-white/60'
                          }`}
                          title="Select Post-Event Attendance / Card Variant"
                        >
                          <option value="unknown" className="bg-[#0A1931] text-white/50">❓ Select Card</option>
                          <option value="attended" className="bg-[#0A1931] text-emerald-300 font-semibold">🟫 Attended (Both/Solo)</option>
                          <option value="did_not_attend" className="bg-[#0A1931] text-amber-200 font-semibold">🥂 Missed (Both/Solo)</option>
                          <option value="attended_partner_missed" className="bg-[#0A1931] text-emerald-200 font-semibold">🟫🥂 Came · Partner Missed</option>
                          <option value="missed_partner_attended" className="bg-[#0A1931] text-amber-300 font-semibold">🥂🟫 Missed · Partner Came</option>
                        </select>
                        <select
                          value={inviteDetails.thank_you_status || 'pending'}
                          onChange={(e) =>
                            handleUpdateThankYouDetails(g, {
                              thank_you_status: e.target.value as 'pending' | 'ready' | 'sent' | 'delivered' | 'seen' | 'failed',
                            })
                          }
                          className={`text-[9px] font-semibold px-1.5 py-0.5 border rounded outline-none cursor-pointer tracking-wider ${
                            inviteDetails.thank_you_status === 'seen' || inviteDetails.thank_you_status === 'delivered'
                              ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40'
                              : inviteDetails.thank_you_status === 'sent'
                              ? 'text-blue-400 bg-blue-500/10 border-blue-500/40'
                              : inviteDetails.thank_you_status === 'ready'
                              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                              : 'text-white/40 bg-white/5 border-white/10'
                          }`}
                        >
                          <option value="pending" className="bg-[#0A1931] text-white/50">⏳ PENDING</option>
                          <option value="ready" className="bg-[#0A1931] text-emerald-300 font-semibold">✅ READY</option>
                          <option value="sent" className="bg-[#0A1931] text-blue-400 font-semibold">📨 SENT</option>
                          <option value="seen" className="bg-[#0A1931] text-yellow-400 font-semibold">👁️ SEEN</option>
                        </select>
                      </div>
                    </div>
                  </td>

                  {/* ── SAVE THE DATE COLUMN (TYPE + STATUS + QUICK WA) ── */}
                  <td className="px-3 py-2 whitespace-nowrap bg-amber-500/5 border-l border-amber-500/20">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      {/* Row 1: Type selector + Quick WA button */}
                      <div className="flex items-center gap-1">
                        <select
                          value={inviteDetails.std_type || ''}
                          onChange={(e) => handleUpdateInvitePhase(g, 'std', 'type', e.target.value)}
                          className="flex-1 bg-[#0A1931] border border-amber-500/40 text-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded outline-none cursor-pointer hover:border-amber-400"
                          title="Select which Save The Date template goes to this guest"
                        >
                          <option value="" className="bg-[#0A1931] text-white/40">— No STD</option>
                          <option value="diwali" className="bg-[#0A1931] text-amber-300">🪔 Diwali</option>
                          <option value="40_festive" className="bg-[#0A1931] text-[#E8D5A3]">🎂 40 &amp; Festive</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(g, inviteDetails.std_type === 'diwali' ? 'save_date_diwali' : 'save_date')}
                          title={`Send ${inviteDetails.std_type === 'diwali' ? 'Diwali' : '40 & Festive'} Save The Date via WhatsApp`}
                          className="px-1.5 py-0.5 border border-green-500/40 text-green-400 hover:bg-green-500/20 rounded text-[9px] font-bold transition-all whitespace-nowrap"
                        >
                          💬 WA
                        </button>
                      </div>

                      {/* Row 2: Status pill / dropdown */}
                      <select
                        value={inviteDetails.std_status || 'pending'}
                        onChange={(e) => handleUpdateInvitePhase(g, 'std', 'status', e.target.value)}
                        className={`text-[9px] font-semibold px-2 py-0.5 border rounded outline-none cursor-pointer tracking-wider ${
                          inviteDetails.std_status === 'seen'
                            ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40'
                            : inviteDetails.std_status === 'sent'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/40'
                            : 'text-white/40 bg-white/5 border-white/10'
                        }`}
                      >
                        <option value="pending" className="bg-[#0A1931] text-white/50">⏳ PENDING</option>
                        <option value="sent" className="bg-[#0A1931] text-blue-400 font-semibold">📨 SENT</option>
                        <option value="seen" className="bg-[#0A1931] text-yellow-400 font-semibold">👁️ SEEN</option>
                      </select>
                    </div>
                  </td>

                  {/* ── MAIN INVITE COLUMN (TYPE + STATUS + QUICK WA) ── */}
                  <td className="px-3 py-2 whitespace-nowrap bg-yellow-500/5 border-l border-yellow-500/20">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      {/* Row 1: Type selector + Quick WA button */}
                      <div className="flex items-center gap-1">
                        <select
                          value={inviteDetails.main_type || ''}
                          onChange={(e) => handleUpdateInvitePhase(g, 'main', 'type', e.target.value)}
                          className="flex-1 bg-[#0A1931] border border-yellow-500/40 text-yellow-200 text-[10px] font-semibold px-1.5 py-0.5 rounded outline-none cursor-pointer hover:border-yellow-400"
                          title="Select which Main Invite template goes to this guest"
                        >
                          <option value="" className="bg-[#0A1931] text-white/40">— No Main</option>
                          <option value="diwali" className="bg-[#0A1931] text-amber-300">🪔 Diwali</option>
                          <option value="40_festive" className="bg-[#0A1931] text-[#E8D5A3]">🎂 40 &amp; Festive</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(g, inviteDetails.main_type === 'diwali' ? 'invite_diwali' : 'invite')}
                          title={`Send ${inviteDetails.main_type === 'diwali' ? 'Diwali' : '40 & Festive'} Main Invite via WhatsApp`}
                          className="px-1.5 py-0.5 border border-green-500/40 text-green-400 hover:bg-green-500/20 rounded text-[9px] font-bold transition-all whitespace-nowrap"
                        >
                          💬 WA
                        </button>
                      </div>

                      {/* Row 2: Status pill / dropdown */}
                      <select
                        value={inviteDetails.main_status || 'pending'}
                        onChange={(e) => handleUpdateInvitePhase(g, 'main', 'status', e.target.value)}
                        className={`text-[9px] font-semibold px-2 py-0.5 border rounded outline-none cursor-pointer tracking-wider ${
                          inviteDetails.main_status === 'seen'
                            ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40'
                            : inviteDetails.main_status === 'sent'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/40'
                            : 'text-white/40 bg-white/5 border-white/10'
                        }`}
                      >
                        <option value="pending" className="bg-[#0A1931] text-white/50">⏳ PENDING</option>
                        <option value="sent" className="bg-[#0A1931] text-blue-400 font-semibold">📨 SENT</option>
                        <option value="seen" className="bg-[#0A1931] text-yellow-400 font-semibold">👁️ SEEN</option>
                      </select>
                    </div>
                  </td>

                  {/* ── INSTAGRAM COLUMN (TYPE + STATUS + QUICK WA) ── */}
                  <td className="px-3 py-2 whitespace-nowrap bg-pink-500/5 border-l border-pink-500/20">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      {/* Row 1: Type selector + Quick WA button */}
                      <div className="flex items-center gap-1">
                        <select
                          value={inviteDetails.insta_type || '40_festive'}
                          onChange={(e) => handleUpdateInvitePhase(g, 'insta', 'type', e.target.value)}
                          className="flex-1 bg-[#0A1931] border border-pink-500/40 text-pink-200 text-[10px] font-semibold px-1.5 py-0.5 rounded outline-none cursor-pointer hover:border-pink-400"
                          title="Select which Instagram template goes to this guest"
                        >
                          <option value="40_festive" className="bg-[#0A1931] text-[#E8D5A3]">🎂 40 &amp; Festive</option>
                          <option value="soiree" className="bg-[#0A1931] text-amber-300">🪔 The Festive Soirée</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(g, inviteDetails.insta_type === 'soiree' ? 'insta_soiree' : 'insta')}
                          title={`Send ${inviteDetails.insta_type === 'soiree' ? 'The Festive Soirée' : '40 & Festive'} Instagram Page to ${g.first_name} via WhatsApp`}
                          className="px-1.5 py-0.5 border border-pink-500/40 text-pink-300 hover:bg-pink-500/20 rounded text-[9px] font-bold transition-all whitespace-nowrap"
                        >
                          📸 WA
                        </button>
                      </div>

                      {/* Row 2: Status pill / dropdown */}
                      <select
                        value={inviteDetails.insta_status || 'pending'}
                        onChange={(e) => handleUpdateInvitePhase(g, 'insta', 'status', e.target.value)}
                        className={`text-[9px] font-semibold px-2 py-0.5 border rounded outline-none cursor-pointer tracking-wider ${
                          inviteDetails.insta_status === 'seen'
                            ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40'
                            : inviteDetails.insta_status === 'sent'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/40'
                            : 'text-white/40 bg-white/5 border-white/10'
                        }`}
                      >
                        <option value="pending" className="bg-[#0A1931] text-white/50">⏳ PENDING</option>
                        <option value="sent" className="bg-[#0A1931] text-blue-400 font-semibold">📨 SENT</option>
                        <option value="seen" className="bg-[#0A1931] text-yellow-400 font-semibold">👁️ SEEN</option>
                      </select>
                    </div>
                  </td>

                  {/* TOGETHER / SEPARATE */}
                  <td className="px-3 py-3 border-l border-white/5 whitespace-nowrap">
                    {g.linked_guest_id ? (
                      <button onClick={() => toggleTogether(g)} title={g.send_together ? 'Click to send separately' : 'Click to send together'}
                        className={`px-2 py-1 border rounded-sm text-[10px] whitespace-nowrap transition-all ${g.send_together ? 'border-[#C9A84C]/50 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/15 text-white/35 hover:border-[#C9A84C]/30'}`}>
                        {g.send_together ? '👫 Together' : '👤 Separate'}
                      </button>
                    ) : <span className="text-white/15 text-[10px]">—</span>}
                  </td>

                  <td className="px-3 py-3 font-mono text-[11px] text-[#C9A84C]/60 whitespace-nowrap">{g.invite_code}</td>

                  {/* ACTIONS */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => copyLink(g.invite_code)} title="Copy Card link (/i/code)"
                        className={`px-2 py-1 border rounded-sm text-[10px] transition-all whitespace-nowrap ${copied === g.invite_code ? 'border-green-500/40 text-green-400' : 'border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10'}`}>
                        {copied === g.invite_code ? '✓ Copied' : '📋 Copy Link'}
                      </button>
                      <button onClick={() => sendWhatsApp(g)} title="Send active template via WhatsApp"
                        className="px-2 py-1 border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-sm text-[10px] font-medium transition-all whitespace-nowrap">
                        💬 WA
                      </button>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            sendWhatsApp(g, e.target.value as MessageTemplateMode)
                            e.target.value = ''
                          }
                        }}
                        className="bg-[#0A1931] border border-green-500/30 text-green-400 text-[10px] px-1 py-1 rounded-sm outline-none cursor-pointer hover:border-green-400 font-medium"
                        title="Send specific invite to this guest"
                      >
                        <option value="">▾ Send Specific</option>
                        <optgroup label="🎂 40 &amp; Festive">
                          <option value="save_date">🗓️ 40 &amp; Festive - Save The Date</option>
                          <option value="invite">💌 40 &amp; Festive - Main Invite</option>
                        </optgroup>
                        <optgroup label="🪔 Diwali Party">
                          <option value="save_date_diwali">✨ Diwali Party - Save The Date</option>
                          <option value="invite_diwali">🎉 Diwali Party - Main Invite</option>
                        </optgroup>
                        <optgroup label="📸 Instagram">
                          <option value="insta">🎂 40 &amp; Festive Instagram</option>
                          <option value="insta_soiree">🪔 The Festive Soirée Instagram</option>
                        </optgroup>
                        <optgroup label="🎂✨ Thank You — 40 &amp; Festive">
                          <option value="thankyou_attended">🟫 Card A — Attended (40 &amp; Festive)</option>
                          <option value="thankyou_missed">🥂 Card B — Missed (40 &amp; Festive)</option>
                          <option value="thankyou_attended_partner_missed">🟫🥂 Card C — Came, Partner Missed (40 &amp; Festive)</option>
                          <option value="thankyou_missed_partner_attended">🥂🟫 Card D — Missed, Partner Came (40 &amp; Festive)</option>
                        </optgroup>
                        <optgroup label="🪔✨ Thank You — The Festive Soirée">
                          <option value="thankyou_soiree_attended">🟫 Card A — Attended (Festive Soirée)</option>
                          <option value="thankyou_soiree_missed">🥂 Card B — Missed (Festive Soirée)</option>
                          <option value="thankyou_soiree_attended_partner_missed">🟫🥂 Card C — Came, Partner Missed (Festive Soirée)</option>
                          <option value="thankyou_soiree_missed_partner_attended">🥂🟫 Card D — Missed, Partner Came (Festive Soirée)</option>
                        </optgroup>
                      </select>
                      <button onClick={() => {
                        const previewUrl = messageTemplate === 'insta_soiree'
                          ? `${BASE_URL}/i/${g.invite_code}?type=insta_soiree`
                          : messageTemplate === 'insta'
                          ? `${BASE_URL}/i/${g.invite_code}?type=insta`
                          : messageTemplate === 'save_date_diwali'
                          ? `${BASE_URL}/i/${g.invite_code}?type=save_date_diwali`
                          : messageTemplate === 'save_date'
                          ? `${BASE_URL}/i/${g.invite_code}?type=save_date`
                          : messageTemplate === 'invite_diwali'
                          ? `${BASE_URL}/i/${g.invite_code}?type=main_diwali`
                          : messageTemplate === 'thankyou_attended'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_attended`
                          : messageTemplate === 'thankyou_missed'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_missed`
                          : messageTemplate === 'thankyou_attended_partner_missed'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_attended_partner_missed`
                          : messageTemplate === 'thankyou_missed_partner_attended'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_missed_partner_attended`
                          : messageTemplate === 'thankyou_soiree_attended'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_attended`
                          : messageTemplate === 'thankyou_soiree_missed'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_missed`
                          : messageTemplate === 'thankyou_soiree_attended_partner_missed'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_attended_partner_missed`
                          : messageTemplate === 'thankyou_soiree_missed_partner_attended'
                          ? `${BASE_URL}/i/${g.invite_code}?type=thankyou_soiree_missed_partner_attended`
                          : `${BASE_URL}/i/${g.invite_code}`
                        window.open(previewUrl, '_blank')
                      }} title="Preview Active Card / Page"
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
      )}

      {/* ══ ADD GUEST MODAL ══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4">
          <div className="glass w-full max-w-xl mx-auto rounded-sm p-6 shadow-2xl">
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
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invited By (Host)</label>
                  <input value={form.guest_of} onChange={e => setForm(f => ({ ...f, guest_of: e.target.value }))} placeholder="e.g. Arpit / Tanvi / Vipul"
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
          <div className="glass w-full max-w-xl mx-auto rounded-sm p-6 shadow-2xl">
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
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invited By (Host)</label>
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

      {/* ══ MANAGE PORTAL USERS MODAL (Super Admin Only) ══ */}
      {showUsersModal && currentUser?.role === 'super_admin' && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4 flex items-center justify-center">
          <div className="glass w-full max-w-2xl mx-auto rounded-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-[#C9A84C]/20 pb-3">
              <div>
                <h2 className="font-serif text-xl text-[#F5ECD7] flex items-center gap-2">
                  <span>👥</span> Portal Users & Host Accounts
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Create and manage users who can log in to add and manage their own guests.
                </p>
              </div>
              <button onClick={() => setShowUsersModal(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            {/* List Existing Users */}
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest text-[#C9A84C]/80 mb-3 font-semibold">
                Existing Portal Users ({portalUsers.length}):
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {portalUsers.map(u => (
                  <div key={u.id} className="border border-white/10 bg-white/5 rounded-sm p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#F5ECD7]">{u.name}</p>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-semibold ${u.role === 'super_admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {u.role === 'super_admin' ? 'Super Admin' : 'Host User'}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 font-mono mt-0.5">Username: <strong className="text-white/70">{u.username}</strong></p>
                      <p className="text-xs text-white/30 font-mono">Password: <strong className="text-[#C9A84C]/70">{u.password}</strong></p>
                    </div>
                    {u.id !== 'user-admin' && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-400/50 hover:text-red-400 text-xs px-2 py-1 border border-red-500/10 hover:border-red-500/30 rounded"
                        title="Delete User"
                      >
                        ✕ Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form to Add New User */}
            <div className="border-t border-[#C9A84C]/20 pt-5">
              <h3 className="text-xs uppercase tracking-widest text-[#C9A84C] mb-3 font-semibold">
                + Create New Portal User / Host:
              </h3>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Full Name (Host Name) *</label>
                    <input
                      required
                      placeholder="e.g. Rahul, Sneha"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Login Username *</label>
                    <input
                      required
                      placeholder="e.g. rahul"
                      value={newUserUsername}
                      onChange={e => setNewUserUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Password *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. rahul123"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">User Role / Rights</label>
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value as 'super_admin' | 'user')}
                      className="w-full bg-[#0A1931] border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="user">Host User (Manages Own Guests)</option>
                      <option value="super_admin">Super Admin (Sees All Guests)</option>
                    </select>
                  </div>
                </div>

                {userMsg && <p className="text-xs text-green-400 font-medium">{userMsg}</p>}

                <div className="flex gap-3 mt-2">
                  <button type="submit" className="btn-primary py-2.5 px-6 text-xs uppercase tracking-widest flex-1">
                    + Add New User Account
                  </button>
                  <button type="button" onClick={() => setShowUsersModal(false)} className="btn-outline py-2.5 px-6 text-xs uppercase tracking-widest">
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ CUSTOM LINKS & TEMPLATES MODAL ══ */}
      {showLinksModal && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4 flex items-center justify-center">
          <div className="glass w-full max-w-xl mx-auto rounded-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-[#C9A84C]/20 pb-3">
              <div>
                <h2 className="font-serif text-xl text-[#F5ECD7] flex items-center gap-2">
                  <span>⚙️</span> Event Links & WhatsApp Settings
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  Configure custom links sent in WhatsApp messages (Location, Photos & Instagram).
                </p>
              </div>
              <button onClick={() => setShowLinksModal(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault()
              localStorage.setItem('portal_custom_links', JSON.stringify(customLinks))
              setShowLinksModal(false)
              alert('✅ Custom links saved!')
            }} className="flex flex-col gap-4">
              {/* Video Folders Guide */}
              <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/25 rounded-sm p-3.5">
                <p className="text-[11px] font-semibold text-[#C9A84C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  📁 Video Folder Location & File Names:
                </p>
                <div className="space-y-1.5 text-xs text-white/80 font-mono">
                  <div className="flex justify-between items-center bg-black/40 px-2.5 py-1.5 rounded">
                    <span>🗓️ Save The Date Video:</span>
                    <span className="text-[#C9A84C] font-semibold">public/videos/save-the-date.mp4</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/40 px-2.5 py-1.5 rounded">
                    <span>💌 Main Digital Invite:</span>
                    <span className="text-green-400 font-semibold">public/videos/main-invite.mp4</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 mt-2 font-sans">
                  💡 Jab aap toolbar mein <strong>Save The Date</strong> choose karke send karenge toh guest ko <code>save-the-date.mp4</code> dikhegi. Jab <strong>Main Digital Invite</strong> choose karenge toh <code>main-invite.mp4</code> dikhegi.
                </p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                  📍 Venue Google Maps Location Link
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={customLinks.locationUrl}
                  onChange={e => setCustomLinks(l => ({ ...l, locationUrl: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40 font-mono"
                />
                <p className="text-[9px] text-white/30 mt-1">Included in "Venue & Location" WhatsApp messages.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                  📸 Event Photos Gallery Link (Google Drive / Photos)
                </label>
                <input
                  type="url"
                  placeholder="https://photos.app.goo.gl/... or https://drive.google.com/..."
                  value={customLinks.photoUrl}
                  onChange={e => setCustomLinks(l => ({ ...l, photoUrl: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40 font-mono"
                />
                <p className="text-[9px] text-white/30 mt-1">Included in "Photos & Instagram" WhatsApp messages.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#C9A84C] block mb-1">
                  ✨ Instagram Reel / Filter / Profile Link
                </label>
                <input
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={customLinks.instaUrl}
                  onChange={e => setCustomLinks(l => ({ ...l, instaUrl: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40 font-mono"
                />
                <p className="text-[9px] text-white/30 mt-1">Included in "Photos & Instagram" WhatsApp messages.</p>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="submit" className="btn-primary py-2.5 px-6 text-xs uppercase tracking-widest flex-1">
                  Save Link Settings
                </button>
                <button type="button" onClick={() => setShowLinksModal(false)} className="btn-outline py-2.5 px-6 text-xs uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
