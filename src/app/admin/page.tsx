'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Guest } from '@/lib/supabase'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'arpit40'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://khandelwal-invitation.vercel.app'
const VIPUL_PHONE = '919414036060'

type FoodPref = 'vegetarian' | 'jain' | 'non-vegetarian' | 'other' | ''
type LiquorPref = 'yes' | 'no' | 'maybe' | ''

interface PersonForm {
  first_name: string
  last_name: string
  nickname: string        // home/informal name
  mobile: string
  food_preference: FoodPref
  liquor_preference: LiquorPref
  invite_code: string
}

const emptyPerson = (): PersonForm => ({
  first_name: '', last_name: '', nickname: '', mobile: '',
  food_preference: '', liquor_preference: '', invite_code: generateCode(),
})

interface FormState {
  primary: PersonForm
  spouse: PersonForm
  has_spouse: boolean
  send_together: boolean  // one link for both OR separate links
  guest_of: string
  relationship_group: string
}

const emptyForm = (): FormState => ({
  primary: emptyPerson(),
  spouse: { ...emptyPerson(), invite_code: generateCode() },
  has_spouse: false,
  send_together: true,
  guest_of: '',
  relationship_group: '',
})

// ── Preference button ──
function PrefBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 py-2 border rounded-sm text-[10px] tracking-wide transition-all duration-200 ${
        active ? 'border-[#C9A84C]/70 text-[#C9A84C] bg-[#C9A84C]/8' : 'border-white/10 text-white/40 hover:border-white/25'
      }`}>
      {label}
    </button>
  )
}

// ── Person section in form ──
function PersonSection({
  label, person, onChange,
}: {
  label: string
  person: PersonForm
  onChange: (p: PersonForm) => void
}) {
  const set = (field: keyof PersonForm, val: string) => onChange({ ...person, [field]: val })
  return (
    <div className="border border-[#C9A84C]/10 rounded-sm p-4 flex flex-col gap-3">
      <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60">{label}</p>

      {/* Names row */}
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

      {/* Nickname */}
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">
          Nickname / Home Name <span className="text-white/20 normal-case">(optional — e.g. Pinky, Bhai)</span>
        </label>
        <input value={person.nickname} onChange={e => set('nickname', e.target.value)}
          placeholder="Informal name used at home"
          className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
      </div>

      {/* Mobile */}
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Mobile</label>
        <input value={person.mobile} onChange={e => set('mobile', e.target.value)}
          placeholder="9876543210"
          className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
      </div>

      {/* Food preference */}
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Food</label>
        <div className="flex gap-1.5">
          {(['vegetarian', 'jain', 'non-vegetarian', 'other'] as FoodPref[]).map(opt => (
            <PrefBtn key={opt} label={opt === 'non-vegetarian' ? 'Non-Veg' : opt === 'vegetarian' ? 'Veg' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={person.food_preference === opt}
              onClick={() => set('food_preference', person.food_preference === opt ? '' : opt)} />
          ))}
        </div>
      </div>

      {/* Liquor preference */}
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Drinks / Liquor</label>
        <div className="flex gap-1.5">
          {(['yes', 'no', 'maybe'] as LiquorPref[]).map(opt => (
            <PrefBtn key={opt} label={opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={person.liquor_preference === opt}
              onClick={() => set('liquor_preference', person.liquor_preference === opt ? '' : opt)} />
          ))}
        </div>
      </div>

      {/* Invite code */}
      <div>
        <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invite Code</label>
        <div className="flex gap-2">
          <input value={person.invite_code} onChange={e => set('invite_code', e.target.value.toUpperCase())}
            maxLength={8}
            className="flex-1 bg-white/5 border border-[#C9A84C]/20 rounded-sm px-3 py-2 text-sm text-[#C9A84C] font-mono outline-none focus:border-[#C9A84C]/50" />
          <button type="button" onClick={() => set('invite_code', generateCode())}
            className="btn-outline px-3 py-2 text-xs">↻</button>
        </div>
        <p className="text-[9px] text-white/20 mt-1">{BASE_URL}/i/{person.invite_code}</p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('guests').select('*').order('created_at', { ascending: false })
    if (data) setGuests(data)
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) fetchGuests() }, [authed, fetchGuests])

  const handleLogin = () => {
    if (pass === ADMIN_PASS) setAuthed(true)
    else alert('Wrong password!')
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.primary.first_name.trim()) return alert('Primary guest first name required')
    setSaving(true)

    try {
      const sharedDetails = {
        guest_of: form.guest_of.trim(),
        relationship_group: form.relationship_group,
      }

      if (!form.has_spouse) {
        const { error } = await supabase.from('guests').insert({
          ...sharedDetails,
          first_name: form.primary.first_name.trim(),
          last_name: form.primary.last_name.trim(),
          nickname: form.primary.nickname.trim() || null,
          mobile: form.primary.mobile.trim(),
          food_preference: form.primary.food_preference || null,
          liquor_preference: form.primary.liquor_preference || null,
          invite_code: form.primary.invite_code,
          invited_count: 1,
        })
        if (error) throw error

      } else if (form.send_together) {
        const partnerName = `${form.spouse.first_name.trim()}${form.spouse.last_name.trim() ? ' ' + form.spouse.last_name.trim() : ''}`

        const { data: primaryRow, error: e1 } = await supabase.from('guests').insert({
          ...sharedDetails,
          first_name: form.primary.first_name.trim(),
          last_name: form.primary.last_name.trim(),
          nickname: form.primary.nickname.trim() || null,
          mobile: form.primary.mobile.trim(),
          food_preference: form.primary.food_preference || null,
          liquor_preference: form.primary.liquor_preference || null,
          partner_name: partnerName,
          partner_mobile: form.spouse.mobile.trim() || null,
          invite_code: form.primary.invite_code,
          invited_count: 2,
          send_together: true,
        }).select().single()
        if (e1) throw e1

        const { data: spouseRow, error: e2 } = await supabase.from('guests').insert({
          ...sharedDetails,
          first_name: form.spouse.first_name.trim(),
          last_name: form.spouse.last_name.trim(),
          nickname: form.spouse.nickname.trim() || null,
          mobile: form.spouse.mobile.trim(),
          food_preference: form.spouse.food_preference || null,
          liquor_preference: form.spouse.liquor_preference || null,
          invite_code: form.spouse.invite_code,
          invited_count: 1,
          send_together: true,
        }).select().single()
        if (e2) throw e2

        if (primaryRow && spouseRow) {
          await supabase.from('guests').update({ linked_guest_id: spouseRow.id }).eq('id', primaryRow.id)
          await supabase.from('guests').update({ linked_guest_id: primaryRow.id }).eq('id', spouseRow.id)
        }

      } else {
        const { data: primaryRow, error: e1 } = await supabase.from('guests').insert({
          ...sharedDetails,
          first_name: form.primary.first_name.trim(),
          last_name: form.primary.last_name.trim(),
          nickname: form.primary.nickname.trim() || null,
          mobile: form.primary.mobile.trim(),
          food_preference: form.primary.food_preference || null,
          liquor_preference: form.primary.liquor_preference || null,
          invite_code: form.primary.invite_code,
          invited_count: 1,
          send_together: false,
        }).select().single()
        if (e1) throw e1

        const { data: spouseRow, error: e2 } = await supabase.from('guests').insert({
          ...sharedDetails,
          first_name: form.spouse.first_name.trim(),
          last_name: form.spouse.last_name.trim(),
          nickname: form.spouse.nickname.trim() || null,
          mobile: form.spouse.mobile.trim(),
          food_preference: form.spouse.food_preference || null,
          liquor_preference: form.spouse.liquor_preference || null,
          invite_code: form.spouse.invite_code,
          invited_count: 1,
          send_together: false,
        }).select().single()
        if (e2) throw e2

        if (primaryRow && spouseRow) {
          await supabase.from('guests').update({ linked_guest_id: spouseRow.id }).eq('id', primaryRow.id)
          await supabase.from('guests').update({ linked_guest_id: primaryRow.id }).eq('id', spouseRow.id)
        }
      }

      setForm(emptyForm())
      setShowForm(false)
      fetchGuests()

    } catch (err: any) {
      alert('Error saving guest: ' + (err?.message || 'Unknown error. Check Supabase SQL columns are added!'))
    } finally {
      setSaving(false)
    }
  }

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/i/${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const sendWhatsApp = (guest: Guest) => {
    const link = `${BASE_URL}/i/${guest.invite_code}`
    const name = guest.nickname || (guest.partner_name ? `${guest.first_name} & ${guest.partner_name}` : guest.first_name)
    const msg = `Hi ${name}! 🎂🪔\n\nArpit ke 40th Birthday aur Diwali celebration ke liye ek khaas invitation aapka intezaar kar raha hai...\n\n👉 ${link}\n\n— Vipul`
    window.open(`https://wa.me/${VIPUL_PHONE}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const deleteGuest = async (id: string) => {
    if (!confirm('Delete this guest?')) return
    await supabase.from('guests').delete().eq('id', id)
    fetchGuests()
  }

  const filtered = guests.filter(g =>
    `${g.first_name} ${g.last_name} ${g.partner_name} ${g.mobile} ${(g as any).nickname}`.toLowerCase().includes(search.toLowerCase())
  )

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#050D1A] flex items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/40 mb-3">Admin Access</p>
            <h1 className="font-serif text-2xl text-[#F5ECD7]">Arpit @ 40</h1>
          </div>
          <div className="glass rounded-sm p-6 flex flex-col gap-4">
            <input type="password" placeholder="Password" value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="bg-transparent border-b border-[#C9A84C]/20 pb-2 text-[#F5ECD7] font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/50" />
            <button onClick={handleLogin} className="btn-primary py-3 text-sm tracking-widest uppercase">Enter</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050D1A] text-white font-sans">
      {/* Header */}
      <div className="border-b border-[#C9A84C]/10 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="font-serif text-xl text-[#C9A84C]">Arpit @ 40 × Diwali</h1>
          <p className="text-[10px] tracking-widest uppercase text-white/30 mt-0.5">Guest Management</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-serif text-[#C9A84C]">{guests.length}</p>
          <p className="text-[10px] text-white/30 tracking-widest uppercase">Records</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-[#C9A84C]/10">
        {[
          { label: 'Total', val: guests.length },
          { label: 'Opened', val: guests.filter(g => g.invitation_status !== 'pending').length },
          { label: 'RSVP Yes', val: guests.filter(g => g.invitation_status === 'rsvp_yes').length },
          { label: 'Pending', val: guests.filter(g => g.invitation_status === 'pending').length },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center border-r border-[#C9A84C]/10 last:border-0">
            <p className="text-lg font-serif text-[#C9A84C]">{s.val}</p>
            <p className="text-[9px] text-white/30 tracking-widest uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 flex gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests..."
          className="flex-1 bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#C9A84C]/40" />
        <button onClick={() => { setShowForm(true); setForm(emptyForm()) }}
          className="btn-primary px-5 py-2 text-sm tracking-wider whitespace-nowrap">+ Add Guest</button>
        <button onClick={fetchGuests} className="btn-outline px-4 py-2 text-sm">↻</button>
      </div>

      {/* ══════════ ADD GUEST MODAL ══════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto py-8 px-4">
          <div className="glass w-full max-w-lg mx-auto rounded-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-xl text-[#F5ECD7]">Add Guest</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col gap-5">

              {/* Primary guest */}
              <PersonSection label="Primary Guest" person={form.primary}
                onChange={p => setForm(f => ({ ...f, primary: p }))} />

              {/* Has spouse toggle */}
              <div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, has_spouse: !f.has_spouse }))}
                  className={`w-full py-2.5 border rounded-sm text-xs tracking-widest uppercase transition-all ${form.has_spouse ? 'border-[#C9A84C]/40 text-[#C9A84C]' : 'border-white/10 text-white/40'}`}>
                  {form.has_spouse ? '✓ Spouse / Partner Added' : '+ Add Spouse / Partner'}
                </button>
              </div>

              {/* Spouse section */}
              {form.has_spouse && (
                <>
                  <PersonSection label="Spouse / Partner" person={form.spouse}
                    onChange={p => setForm(f => ({ ...f, spouse: p }))} />

                  {/* Together / Separate */}
                  <div className="border border-[#C9A84C]/10 rounded-sm p-4">
                    <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60 mb-3">Invite Type</p>
                    <div className="flex flex-col gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, send_together: true }))}
                        className={`w-full py-3 px-4 border rounded-sm text-left transition-all ${form.send_together ? 'border-[#C9A84C]/50 bg-[#C9A84C]/5' : 'border-white/10'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full border-2 ${form.send_together ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-white/30'}`} />
                          <div>
                            <p className="text-sm text-[#F5ECD7]">Together — One Link</p>
                            <p className="text-[10px] text-white/30 mt-0.5">
                              Invitation shows "{form.primary.first_name || 'Palak'} & {form.spouse.first_name || 'Neha'}" — both RSVP together
                            </p>
                          </div>
                        </div>
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, send_together: false }))}
                        className={`w-full py-3 px-4 border rounded-sm text-left transition-all ${!form.send_together ? 'border-[#C9A84C]/50 bg-[#C9A84C]/5' : 'border-white/10'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full border-2 ${!form.send_together ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-white/30'}`} />
                          <div>
                            <p className="text-sm text-[#F5ECD7]">Separate — Two Links</p>
                            <p className="text-[10px] text-white/30 mt-0.5">
                              Each gets personal link — "{form.primary.first_name || 'Palak'}" and "{form.spouse.first_name || 'Neha'}" RSVP individually
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Other details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Invited By</label>
                  <input value={form.guest_of} onChange={e => setForm(f => ({ ...f, guest_of: e.target.value }))}
                    placeholder="Arpit / Vipul"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Group</label>
                  <select value={form.relationship_group} onChange={e => setForm(f => ({ ...f, relationship_group: e.target.value }))}
                    className="w-full bg-[#0A1931] border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40">
                    <option value="">Select</option>
                    <option value="family">Family</option>
                    <option value="friends">Friends</option>
                    <option value="business">Business</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-sm tracking-wider">
                  {saving ? 'Saving...' : form.has_spouse && !form.send_together ? 'Save 2 Guests (Separate)' : 'Save Guest'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline px-6 py-3 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ GUEST LIST ══════════ */}
      <div className="px-6 pb-16">
        {loading ? (
          <div className="text-center py-20 text-white/30">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="font-serif text-xl mb-2">No guests yet</p>
            <p className="text-sm">Click "+ Add Guest" to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(g => {
              const displayName = g.partner_name ? `${g.first_name} & ${g.partner_name}` : g.first_name
              const nickname = (g as any).nickname
              const foodPref = (g as any).food_preference
              const liquorPref = (g as any).liquor_preference
              const link = `${BASE_URL}/i/${g.invite_code}`
              const statusColor: Record<string, string> = {
                pending: 'text-white/30', opened: 'text-blue-400',
                entered: 'text-yellow-400', rsvp_yes: 'text-green-400', rsvp_no: 'text-red-400',
              }

              return (
                <div key={g.id} className="glass rounded-sm p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-serif text-[#F5ECD7] text-base">{displayName}</p>
                      {nickname && <p className="text-[11px] text-[#C9A84C]/50 italic">"{nickname}"</p>}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {g.mobile && <span className="text-[11px] text-white/35">{g.mobile}</span>}
                        {g.guest_of && <span className="text-[11px] text-[#C9A84C]/35">via {g.guest_of}</span>}
                        {g.relationship_group && <span className="text-[11px] text-white/25 capitalize">{g.relationship_group}</span>}
                        {foodPref && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/40 capitalize">{foodPref}</span>}
                        {liquorPref && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/40 capitalize">🥂 {liquorPref}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-[10px] tracking-widest uppercase ${statusColor[g.invitation_status] || 'text-white/30'}`}>
                        {g.invitation_status}
                      </span>
                      <p className="text-[10px] text-white/20 font-mono mt-1">{g.invite_code}</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-sm px-3 py-1.5 mb-3">
                    <p className="text-[10px] text-[#C9A84C]/50 font-mono truncate">{link}</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => copyLink(g.invite_code)}
                      className={`flex-1 py-2 border rounded-sm text-[11px] tracking-wider transition-all ${copied === g.invite_code ? 'border-green-500/40 text-green-400' : 'border-white/10 text-white/50 hover:border-[#C9A84C]/30 hover:text-[#C9A84C]/70'}`}>
                      {copied === g.invite_code ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <button onClick={() => sendWhatsApp(g)}
                      className="flex-1 py-2 border border-green-500/20 text-green-400/70 hover:border-green-500/50 hover:text-green-400 rounded-sm text-[11px] tracking-wider transition-all">
                      WhatsApp
                    </button>
                    <button onClick={() => window.open(link, '_blank')}
                      className="px-3 py-2 border border-white/10 text-white/30 hover:text-white/60 rounded-sm text-[11px] transition-all">
                      Preview
                    </button>
                    <button onClick={() => deleteGuest(g.id)}
                      className="px-3 py-2 border border-red-500/10 text-red-400/30 hover:text-red-400/60 hover:border-red-500/30 rounded-sm text-[11px] transition-all">
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
