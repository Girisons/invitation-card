'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Guest } from '@/lib/supabase'

// Simple admin password check
const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'arpit40'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://khandelwal-invitation.vercel.app'
const VIPUL_PHONE = '919414036060'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '', last_name: '', mobile: '',
    partner_first_name: '', partner_last_name: '', partner_mobile: '',
    guest_of: '', relationship_group: '',
    invited_count: '1', invite_code: generateCode(),
  })

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('guests').select('*').order('created_at', { ascending: false })
    if (data) setGuests(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authed) fetchGuests()
  }, [authed, fetchGuests])

  const handleLogin = () => {
    if (pass === ADMIN_PASS) setAuthed(true)
    else alert('Wrong password!')
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) return alert('First name required')
    const partnerName = form.partner_first_name.trim()
      ? `${form.partner_first_name.trim()}${form.partner_last_name.trim() ? ' ' + form.partner_last_name.trim() : ''}`
      : ''
    const { error } = await supabase.from('guests').insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      mobile: form.mobile.trim(),
      partner_name: partnerName,
      partner_mobile: form.partner_mobile.trim(),
      guest_of: form.guest_of.trim(),
      relationship_group: form.relationship_group,
      invited_count: parseInt(form.invited_count),
      invite_code: form.invite_code.trim().toUpperCase(),
    })
    if (error) { alert('Error: ' + error.message); return }
    setForm({ first_name: '', last_name: '', mobile: '', partner_first_name: '', partner_last_name: '', partner_mobile: '', guest_of: '', relationship_group: '', invited_count: '1', invite_code: generateCode() })
    setShowForm(false)
    fetchGuests()
  }

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/i/${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const sendWhatsApp = (guest: Guest) => {
    const link = `${BASE_URL}/i/${guest.invite_code}`
    const name = guest.partner_name ? `${guest.first_name} & ${guest.partner_name}` : guest.first_name
    const msg = `Hi ${name}! 🎂🪔\n\nArpit ke 40th Birthday aur Diwali celebration ke liye ek khaas invitation aapka intezaar kar raha hai...\n\n👉 ${link}\n\n— Vipul`
    window.open(`https://wa.me/${VIPUL_PHONE}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const deleteGuest = async (id: string) => {
    if (!confirm('Delete this guest?')) return
    await supabase.from('guests').delete().eq('id', id)
    fetchGuests()
  }

  const filtered = guests.filter(g =>
    `${g.first_name} ${g.last_name} ${g.partner_name} ${g.mobile}`.toLowerCase().includes(search.toLowerCase())
  )

  // ── LOGIN SCREEN ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#050D1A] flex items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/40 mb-3">Admin Access</p>
            <h1 className="font-serif text-2xl text-[#F5ECD7]">Arpit @ 40</h1>
          </div>
          <div className="glass rounded-sm p-6 flex flex-col gap-4">
            <input
              type="password"
              placeholder="Password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="bg-transparent border-b border-[#C9A84C]/20 pb-2 text-[#F5ECD7] font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/50"
            />
            <button onClick={handleLogin} className="btn-primary py-3 text-sm tracking-widest uppercase">
              Enter
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ADMIN DASHBOARD ──
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
          <p className="text-[10px] text-white/30 tracking-widest uppercase">Guests</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-b border-[#C9A84C]/10">
        {[
          { label: 'Invited', val: guests.length },
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
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guests..."
          className="flex-1 bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#C9A84C]/40"
        />
        <button
          onClick={() => { setShowForm(true); setForm(f => ({ ...f, invite_code: generateCode() })) }}
          className="btn-primary px-5 py-2 text-sm tracking-wider whitespace-nowrap"
        >
          + Add Guest
        </button>
        <button onClick={fetchGuests} className="btn-outline px-4 py-2 text-sm">↻</button>
      </div>

      {/* Add Guest Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="glass w-full max-w-md rounded-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-xl text-[#F5ECD7]">Add Guest</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">

              {/* ── PRIMARY GUEST ── */}
              <div>
                <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60 mb-2 border-b border-[#C9A84C]/10 pb-1">Primary Guest</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">First Name *</label>
                    <input required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                  </div>
                  <div>
                    <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Last Name</label>
                    <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Mobile</label>
                  <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
              </div>

              {/* ── SPOUSE / PARTNER ── */}
              <div>
                <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60 mb-2 border-b border-[#C9A84C]/10 pb-1">Spouse / Partner <span className="text-white/20 normal-case">(leave blank if single)</span></p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">First Name</label>
                    <input value={form.partner_first_name} onChange={e => setForm(f => ({ ...f, partner_first_name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                  </div>
                  <div>
                    <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Last Name</label>
                    <input value={form.partner_last_name} onChange={e => setForm(f => ({ ...f, partner_last_name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Spouse Mobile</label>
                  <input value={form.partner_mobile} onChange={e => setForm(f => ({ ...f, partner_mobile: e.target.value }))}
                    placeholder="9876543211"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
              </div>

              {/* ── OTHER DETAILS ── */}
              <div>
                <p className="text-[9px] tracking-widest uppercase text-[#C9A84C]/60 mb-2 border-b border-[#C9A84C]/10 pb-1">Details</p>
                <div>
                  <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Invited By</label>
                  <input value={form.guest_of} onChange={e => setForm(f => ({ ...f, guest_of: e.target.value }))}
                    placeholder="Arpit / Vipul"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Group</label>
                  <select value={form.relationship_group} onChange={e => setForm(f => ({ ...f, relationship_group: e.target.value }))}
                    className="w-full bg-[#0A1931] border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40">
                    <option value="">Select</option>
                    <option value="family">Family</option>
                    <option value="friends">Friends</option>
                    <option value="business">Business</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">No. Invited</label>
                  <input type="number" min="1" max="10" value={form.invited_count} onChange={e => setForm(f => ({ ...f, invited_count: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/40" />
                </div>
              </div>
              <div>
                <label className="text-[9px] tracking-widest uppercase text-[#C9A84C]/50 block mb-1">Invite Code (auto-generated)</label>
                <div className="flex gap-2">
                  <input value={form.invite_code} onChange={e => setForm(f => ({ ...f, invite_code: e.target.value.toUpperCase() }))}
                    maxLength={8}
                    className="flex-1 bg-white/5 border border-[#C9A84C]/20 rounded-sm px-3 py-2 text-sm text-[#C9A84C] font-mono outline-none focus:border-[#C9A84C]/50" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, invite_code: generateCode() }))}
                    className="btn-outline px-3 py-2 text-xs">↻</button>
                </div>
                <p className="text-[9px] text-white/20 mt-1">Link: {BASE_URL}/i/{form.invite_code}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button type="submit" className="btn-primary flex-1 py-3 text-sm tracking-wider">Save Guest</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline px-6 py-3 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Table */}
      <div className="px-6 pb-10">
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
              const link = `${BASE_URL}/i/${g.invite_code}`
              const displayName = g.partner_name ? `${g.first_name} & ${g.partner_name}` : g.first_name
              const statusColor = {
                pending: 'text-white/30', opened: 'text-blue-400',
                entered: 'text-yellow-400', rsvp_yes: 'text-green-400', rsvp_no: 'text-red-400',
              }[g.invitation_status] || 'text-white/30'

              return (
                <div key={g.id} className="glass rounded-sm p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-serif text-[#F5ECD7] text-base">{displayName}</p>
                      <div className="flex gap-3 mt-1">
                        {g.mobile && <p className="text-[11px] text-white/40">{g.mobile}</p>}
                        {g.guest_of && <p className="text-[11px] text-[#C9A84C]/40">via {g.guest_of}</p>}
                        {g.relationship_group && <p className="text-[11px] text-white/30 capitalize">{g.relationship_group}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] tracking-widest uppercase ${statusColor}`}>
                        {g.invitation_status}
                      </span>
                      <p className="text-[10px] text-white/20 font-mono mt-1">{g.invite_code}</p>
                    </div>
                  </div>

                  {/* Link */}
                  <div className="bg-white/5 rounded-sm px-3 py-2 mb-3 flex items-center justify-between">
                    <p className="text-[11px] text-[#C9A84C]/60 font-mono truncate flex-1">{link}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyLink(g.invite_code)}
                      className={`flex-1 py-2 border rounded-sm text-[11px] tracking-wider transition-all ${copied === g.invite_code ? 'border-green-500/40 text-green-400' : 'border-white/10 text-white/50 hover:border-[#C9A84C]/30 hover:text-[#C9A84C]/70'}`}
                    >
                      {copied === g.invite_code ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => sendWhatsApp(g)}
                      className="flex-1 py-2 border border-green-500/20 text-green-400/70 hover:border-green-500/50 hover:text-green-400 rounded-sm text-[11px] tracking-wider transition-all"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => window.open(link, '_blank')}
                      className="px-4 py-2 border border-white/10 text-white/30 hover:text-white/60 rounded-sm text-[11px] transition-all"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => deleteGuest(g.id)}
                      className="px-4 py-2 border border-red-500/10 text-red-400/30 hover:text-red-400/60 hover:border-red-500/30 rounded-sm text-[11px] transition-all"
                    >
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
