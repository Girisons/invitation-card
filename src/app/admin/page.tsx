'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Guest } from '@/lib/supabase'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'arpit40'

export interface PortalUser {
  id: string
  username: string
  password: string
  name: string
  role: 'super_admin' | 'user'
  created_at?: string
}

export type MessageTemplateMode = 'invite' | 'save_date' | 'invite_diwali' | 'save_date_diwali' | 'location' | 'photos'

const DEFAULT_USERS: PortalUser[] = [
  { id: 'user-admin', username: 'admin', password: 'arpit40', name: 'Super Admin', role: 'super_admin', created_at: new Date().toISOString() },
  { id: 'user-arpit', username: 'arpit', password: 'arpit40', name: 'Arpit', role: 'user', created_at: new Date().toISOString() },
  { id: 'user-tanvi', username: 'tanvi', password: 'tanvi40', name: 'Tanvi', role: 'user', created_at: new Date().toISOString() },
  { id: 'user-vipul', username: 'vipul', password: 'vipul40', name: 'Vipul', role: 'user', created_at: new Date().toISOString() },
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
  const [hostFilter, setHostFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const [guestMap, setGuestMap] = useState<Record<string, { name: string; mobile: string }>>({})

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

    const loadUsers = async () => {
      try {
        const { data } = await supabase.from('portal_users').select('*')
        if (data && data.length > 0) {
          setPortalUsers(data)
          localStorage.setItem('portal_users', JSON.stringify(data))
        } else {
          const saved = localStorage.getItem('portal_users')
          if (saved) setPortalUsers(JSON.parse(saved))
          else localStorage.setItem('portal_users', JSON.stringify(DEFAULT_USERS))
        }
      } catch {
        const saved = localStorage.getItem('portal_users')
        if (saved) setPortalUsers(JSON.parse(saved))
        else localStorage.setItem('portal_users', JSON.stringify(DEFAULT_USERS))
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
    localStorage.setItem('portal_users', JSON.stringify(updatedUsers))
    try {
      await supabase.from('portal_users').upsert(updatedUsers)
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

      // Fetch RSVPs to sync status
      const { data: rsvps } = await supabase.from('rsvps').select('*')
      if (rsvps && rsvps.length > 0) {
        for (const g of data) {
          const rsvp = rsvps.find((r: any) => r.guest_id === g.id || (g.linked_guest_id && r.guest_id === g.linked_guest_id))
          if (rsvp && rsvp.status) {
            g.invitation_status = rsvp.status
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
    const pInput = passwordInput.trim()

    // 1. Try matching Username & Password
    let matched = portalUsers.find(u =>
      (u.username.toLowerCase() === uInput || u.name.toLowerCase() === uInput) && u.password === pInput
    )

    // 2. Fallback: if only Password entered or matches Super Admin pass
    if (!matched && pInput === ADMIN_PASS) {
      matched = portalUsers.find(u => u.role === 'super_admin') || DEFAULT_USERS[0]
    }

    // 3. Fallback: match password alone against any user
    if (!matched && pInput) {
      matched = portalUsers.find(u => u.password === pInput)
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
    const { error } = await supabase.from('guests').update({ invitation_status: newStatus }).eq('id', g.id)
    if (error) {
      alert('Error updating attendance: ' + error.message)
      return
    }
    fetchGuests()
  }

  // ── QUICK CHANGE ANY FIELD (FOOD, DRINKS, HOST, GROUP - Strictly individual per guest) ──
  const handleFieldChange = async (g: Guest, field: string, value: string) => {
    const payload: Record<string, any> = { [field]: value || null }
    const { error } = await supabase.from('guests').update(payload).eq('id', g.id)
    if (error) {
      alert(`Error updating ${field}: ` + error.message)
      return
    }
    fetchGuests()
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
      : `${BASE_URL}/i/${code}`
    navigator.clipboard.writeText(linkUrl)
    setCopied(code); setTimeout(() => setCopied(null), 2000)
  }

  // ── WHATSAPP ──
  const sendWhatsApp = async (g: Guest, modeOverride?: MessageTemplateMode) => {
    const activeMode = modeOverride || messageTemplate

    const currentSt = (g.invitation_status || '').toLowerCase()
    if (!currentSt || currentSt === 'pending' || currentSt === 'not_sent') {
      await supabase.from('guests').update({ invitation_status: 'sent' }).eq('id', g.id)
      g.invitation_status = 'sent'
      fetchGuests()
    }

    const mainInviteLink = `${BASE_URL}/i/${g.invite_code}`
    const mainDiwaliInviteLink = `${BASE_URL}/i/${g.invite_code}?type=main_diwali`
    const saveDateLink = `${BASE_URL}/i/${g.invite_code}?type=save_date`
    const saveDateDiwaliLink = `${BASE_URL}/i/${g.invite_code}?type=save_date_diwali`
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

    let msg = ''

    if (activeMode === 'save_date_diwali') {
      const headphones = String.fromCodePoint(0x1F3A7)
      const pointRight = String.fromCodePoint(0x1F449)
      msg = `${EMOJI.sparkles} *SAVE THE DATE* ${EMOJI.sparkles}\n\nDear *${name}*,\n\nGet ready for an unforgettable night of music, lights, and celebration! Mark your calendar for the *Khandelwal Diwali Bash*.\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur, Rajasthan*\n${headphones} *Drinks · Dance · Celebration*\n\nExperience your personalized teaser & add the event to your calendar:\n${pointRight} ${saveDateDiwaliLink}\n\nDetailed invitation with venue to follow soon.\n\nWarmly,\n*The Khandelwal Family*`
    } else if (activeMode === 'invite_diwali') {
      msg = `🪔 *FESTIVAL OF LIGHTS • A GRAND CELEBRATION!* 🪔\n\nDear *${name}*, ${EMOJI.heart}\n\nWe warmly invite ${youTarget} to join us for a grand *Diwali Party Celebration!*\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\nCome celebrate the festival of lights with warmth, joy, music, and wonderful memories together! ✨\n\nWith lots of love,\n*Khandelwal Family*\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainDiwaliInviteLink}`
    } else if (activeMode === 'save_date') {
      msg = `${EMOJI.sparkles} *SAVE THE DATE!* ${EMOJI.sparkles}\n\nDear *${name}*, ${EMOJI.heart}\n\nPlease mark your calendar for *ARPIT’s 40th Birthday & Diwali Celebration!*\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\nDetailed formal invitation to follow soon. We can’t wait to celebrate this special evening with ${youTarget}! ${EMOJI.heart}\n\nWith lots of love,\n*Tanvi Khandelwal & Family*\n\n${EMOJI.gift} *Save The Date Link:*\n${saveDateLink}`
    } else if (activeMode === 'location') {
      const loc = (customLinks.locationUrl || 'https://maps.google.com/?q=Jaipur').trim()
      msg = `📍 *VENUE & LOCATION DETAILS* 📍\n\nDear *${name}*, ${EMOJI.heart}\n\nHere are the venue location details for *Arpit’s 40th & Diwali Bash*:\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\n🗺️ *Google Maps Location Link:*\n${loc}\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainInviteLink}\n\nSee ${youTarget} soon! ${EMOJI.heart}\n*Tanvi Khandelwal & Family*`
    } else if (activeMode === 'photos') {
      const pUrl = (customLinks.photoUrl || mainInviteLink).trim()
      const iUrl = (customLinks.instaUrl || 'https://instagram.com').trim()
      msg = `📸 *EVENT PHOTOS & INSTAGRAM LINK* 📸\n\nDear *${name}*, ${EMOJI.heart}\n\nThank you for making Arpit's 40th & Diwali Bash so special! Here are the event photos and Instagram link for ${youTarget}:\n\n🖼️ *Event Photo Gallery Link:*\n${pUrl}\n\n✨ *Instagram Reel / Story Link:*\n${iUrl}\n\n${EMOJI.gift} *Your Invitation Card:*\n${mainInviteLink}\n\nWith lots of love,\n*Tanvi Khandelwal & Family*`
    } else {
      // Default 'invite'
      msg = `${EMOJI.sparkles} *Four Decades. One Amazing Journey. And Now… One BIG Celebration!* ${EMOJI.sparkles}\n\nDear *${name}*, ${EMOJI.heart}\n\nIt gives me immense pleasure to personally invite ${youTarget} to celebrate my husband *ARPIT’s 40th Birthday & Diwali Celebration!*\n\n${EMOJI.calendar} *Friday, 23rd October 2026*\n${EMOJI.pin} *Jaipur*\n\n*${name} — no excuses, no “we’ll try”, and definitely no last-minute plans! ${EMOJI.wink}*\nWe are waiting to celebrate this beautiful evening with ${youTarget}. ${EMOJI.heart}\n\nWith lots of love,\n*Tanvi Khandelwal & Family*\n\n${EMOJI.gift} *Your Personal Digital Invitation:*\n${mainInviteLink}`
    }

    const phone = formatWhatsAppPhone(g.mobile || '')
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
    const headers = ['Name', 'Nickname', 'Mobile', 'Partner', 'Partner Mobile', 'Attendance', 'Food', 'Drinks', 'Invited By', 'Group', 'Status', 'Invite Code', 'Invite Link']
    const rows = visibleGuests.map(g => {
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
    await supabase.from('guests').update({ send_together: nowTogether }).eq('id', g.id)
    fetchGuests()
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

  // 2. Filter by Selected Host Filter Dropdown (Super Admin only)
  const hostSelectedGuests = roleFilteredGuests.filter(g => {
    if (currentUser?.role !== 'super_admin' || hostFilter === 'all') return true
    return (g.guest_of || '').toLowerCase().trim() === hostFilter.toLowerCase().trim()
  })

  // 3. Filter by Search Query
  const filtered = hostSelectedGuests.filter(g => {
    const partnerName = g.partner_name || (g.linked_guest_id && guestMap[g.linked_guest_id]?.name) || ''
    const partnerMob = g.partner_mobile || (g.linked_guest_id && guestMap[g.linked_guest_id]?.mobile) || ''
    const hostOf = g.guest_of || ''
    return `${g.first_name} ${g.last_name} ${partnerName} ${g.mobile} ${partnerMob} ${g.nickname} ${hostOf}`.toLowerCase().includes(search.toLowerCase())
  })

  const visibleGuests = filtered

  // Attendance stats counts for visible guests
  const pendingCount = visibleGuests.filter(g => !g.invitation_status || ['pending', 'not_sent'].includes((g.invitation_status || '').toLowerCase())).length
  const messageSentCount = visibleGuests.filter(g => ['sent', 'message_sent'].includes((g.invitation_status || '').toLowerCase())).length
  const messageSeenCount = visibleGuests.filter(g => ['opened', 'entered', 'seen', 'message_seen', 'attending', 'declined', 'rsvp_yes', 'rsvp_no', 'yes', 'no'].includes((g.invitation_status || '').toLowerCase())).length
  const attendingCount = visibleGuests.filter(g => ['rsvp_yes', 'attending', 'yes'].includes((g.invitation_status || '').toLowerCase())).length
  const declinedCount = visibleGuests.filter(g => ['rsvp_no', 'declined', 'not_attending', 'no'].includes((g.invitation_status || '').toLowerCase())).length

  // List of distinct hosts for Super Admin filter
  const distinctHosts = Array.from(new Set(guests.map(g => (g.guest_of || 'Unassigned').trim()).filter(Boolean)))

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

        <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-6 border-b border-[#C9A84C]/10">
        {[
          { label: 'Total Guests', val: visibleGuests.length, color: 'text-[#C9A84C]' },
          { label: 'Pending', val: pendingCount, color: 'text-white/40' },
          { label: 'Message Sent', val: messageSentCount, color: 'text-blue-400' },
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests by name, mobile, host..."
          className="flex-1 min-w-[150px] bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#C9A84C]/40" />

        {/* Super Admin Host Filter */}
        {currentUser.role === 'super_admin' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[#C9A84C]/70">Filter Host:</span>
            <select
              value={hostFilter}
              onChange={e => setHostFilter(e.target.value)}
              className="bg-[#0A1931] border border-[#C9A84C]/30 text-[#C9A84C] rounded-sm px-3 py-2 text-xs outline-none font-medium"
            >
              <option value="all">🌟 All Hosts ({guests.length})</option>
              {distinctHosts.map(h => (
                <option key={h} value={h}>👤 {h}</option>
              ))}
            </select>
          </div>
        )}

        {/* Message Link Template Selector */}
        <div className="flex items-center gap-1.5 bg-[#0A1931] border border-[#C9A84C]/30 px-3 py-2 rounded-sm">
          <span className="text-[10px] uppercase tracking-wider text-[#C9A84C] font-semibold">Invite:</span>
          <select
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value as MessageTemplateMode)}
            className="bg-transparent text-[#F5ECD7] text-xs outline-none font-medium cursor-pointer"
          >
            <optgroup label="🎂 40 &amp; Festive">
              <option value="save_date" className="bg-[#0A1931]">🗓️ 40 &amp; Festive - Save The Date</option>
              <option value="invite" className="bg-[#0A1931]">💌 40 &amp; Festive - Main Invite</option>
            </optgroup>
            <optgroup label="🪔 Diwali Party (Family)">
              <option value="save_date_diwali" className="bg-[#0A1931]">✨ Diwali Party - Save The Date</option>
              <option value="invite_diwali" className="bg-[#0A1931]">🎉 Diwali Party - Main Invite</option>
            </optgroup>
            <optgroup label="📍 Other Links">
              <option value="location" className="bg-[#0A1931]">📍 Venue &amp; Location Link</option>
              <option value="photos" className="bg-[#0A1931]">📸 Photos &amp; Instagram Link</option>
            </optgroup>
          </select>
        </div>

        <button
          onClick={() => setShowLinksModal(true)}
          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 px-3 py-2 text-xs rounded-sm whitespace-nowrap font-medium flex items-center gap-1.5 transition-all"
          title="Configure custom Venue Location, Photos, and Instagram links"
        >
          <span>⚙️</span> Custom Links
        </button>

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
            {messageTemplate === 'invite' && '💌 40 & Festive — Main Invite'}
            {messageTemplate === 'save_date_diwali' && '✨ Diwali Party — Save The Date'}
            {messageTemplate === 'invite_diwali' && '🎉 Diwali Party — Main Invite'}
            {messageTemplate === 'location' && '📍 Venue & Location Link'}
            {messageTemplate === 'photos' && '📸 Photos & Instagram Link'}
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

          {/* Other Links */}
          <div className="flex items-center bg-[#050D1A] rounded p-1 border border-blue-500/30 gap-1">
            <button
              onClick={() => setMessageTemplate('location')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'location'
                  ? 'bg-blue-500 text-white font-bold shadow-md ring-1 ring-white/50'
                  : 'text-blue-300/70 hover:text-white hover:bg-white/5'
              }`}
              title="Venue Location Google Maps link"
            >
              📍 Venue
            </button>
            <button
              onClick={() => setMessageTemplate('photos')}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                messageTemplate === 'photos'
                  ? 'bg-purple-500 text-white font-bold shadow-md ring-1 ring-white/50'
                  : 'text-purple-300/70 hover:text-white hover:bg-white/5'
              }`}
              title="Event Photos & Instagram link"
            >
              📸 Photos
            </button>
          </div>
        </div>
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
              <th className="px-4 py-3 text-left">Invited By (Host)</th>
              <th className="px-4 py-3 text-left">Group</th>
              <th className="px-4 py-3 text-left">Msg Status</th>
              <th className="px-4 py-3 text-left">Send As</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="px-4 py-16 text-center text-white/30">Loading...</td></tr>
            ) : visibleGuests.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-16 text-center text-white/30">
                <p className="font-serif text-lg mb-1">No guests found</p>
                <p className="text-xs">Click "+ Add Guest" to add your guests</p>
              </td></tr>
            ) : visibleGuests.map(g => {
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

                  {/* ATTENDANCE COLUMN */}
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={(g.food_preference || '').toLowerCase()}
                      onChange={(e) => handleFieldChange(g, 'food_preference', e.target.value)}
                      className="bg-white/5 border border-white/10 text-white/80 text-[11px] px-2.5 py-1 rounded-full outline-none cursor-pointer hover:border-[#C9A84C]/40 transition-all font-sans"
                    >
                      <option value="" className="bg-[#0A1931] text-white/40">— None</option>
                      <option value="vegetarian" className="bg-[#0A1931] text-green-400 font-medium">🥗 Veg</option>
                      <option value="jain" className="bg-[#0A1931] text-amber-300 font-medium">🥦 Jain</option>
                      <option value="non-vegetarian" className="bg-[#0A1931] text-red-400 font-medium">🍗 Non-Veg</option>
                      <option value="other" className="bg-[#0A1931] text-blue-300 font-medium">🍽️ Other</option>
                    </select>
                  </td>

                  {/* DRINKS COLUMN */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={(g.liquor_preference || '').toLowerCase()}
                      onChange={(e) => handleFieldChange(g, 'liquor_preference', e.target.value)}
                      className="bg-white/5 border border-white/10 text-white/80 text-[11px] px-2.5 py-1 rounded-full outline-none cursor-pointer hover:border-[#C9A84C]/40 transition-all font-sans"
                    >
                      <option value="" className="bg-[#0A1931] text-white/40">— None</option>
                      <option value="yes" className="bg-[#0A1931] text-amber-400 font-medium">🥂 Yes</option>
                      <option value="no" className="bg-[#0A1931] text-white/50 font-medium">🥤 No</option>
                      <option value="maybe" className="bg-[#0A1931] text-blue-400 font-medium">🍸 Maybe</option>
                    </select>
                  </td>

                  {/* INVITED BY (HOST) COLUMN */}
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  {/* MSG STATUS COLUMN */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const st = (g.invitation_status || '').toLowerCase()
                      const msgVal = ['seen', 'message_seen', 'entered', 'opened', 'rsvp_yes', 'rsvp_no', 'attending', 'declined', 'yes', 'no'].includes(st)
                        ? 'seen'
                        : ['sent', 'message_sent'].includes(st)
                        ? 'sent'
                        : 'pending'
                      return (
                        <select
                          value={msgVal}
                          onChange={(e) => handleFieldChange(g, 'invitation_status', e.target.value)}
                          className={`text-[9px] font-semibold px-2 py-1 border rounded-sm tracking-wider whitespace-nowrap outline-none cursor-pointer ${info.color}`}
                        >
                          <option value="pending" className="bg-[#0A1931] text-white/50">PENDING</option>
                          <option value="sent" className="bg-[#0A1931] text-blue-400 font-semibold">MESSAGE SENT</option>
                          <option value="seen" className="bg-[#0A1931] text-yellow-400 font-semibold">MESSAGE SEEN</option>
                        </select>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {g.linked_guest_id ? (
                      <button onClick={() => toggleTogether(g)} title={g.send_together ? 'Click to send separately' : 'Click to send together'}
                        className={`px-2 py-1 border rounded-sm text-[10px] whitespace-nowrap transition-all ${g.send_together ? 'border-[#C9A84C]/50 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/15 text-white/35 hover:border-[#C9A84C]/30'}`}>
                        {g.send_together ? '👫 Together' : '👤 Separate'}
                      </button>
                    ) : <span className="text-white/15 text-[10px]">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#C9A84C]/60">{g.invite_code}</td>
                  <td className="px-4 py-3">
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
                        <optgroup label="📍 Follow-up Links">
                          <option value="location">📍 Venue Location</option>
                          <option value="photos">📸 Photos &amp; Insta</option>
                        </optgroup>
                      </select>
                      <button onClick={() => {
                        const previewUrl = messageTemplate === 'save_date_diwali'
                          ? `${BASE_URL}/i/${g.invite_code}?type=save_date_diwali`
                          : messageTemplate === 'save_date'
                          ? `${BASE_URL}/i/${g.invite_code}?type=save_date`
                          : messageTemplate === 'invite_diwali'
                          ? `${BASE_URL}/i/${g.invite_code}?type=main_diwali`
                          : `${BASE_URL}/i/${g.invite_code}`
                        window.open(previewUrl, '_blank')
                      }} title="Preview Active Video Card"
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
