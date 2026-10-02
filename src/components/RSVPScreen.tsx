'use client'

import { useState, useEffect } from 'react'
import { Guest, submitRSVP, savePreferences, trackEvent } from '@/lib/supabase'
import { EVENT } from '@/lib/config'

interface Props {
  guest: Guest
  guestName: string
  onComplete: (status: 'attending' | 'declined') => void
  active: boolean
}

type Step = 'decision' | 'attendees' | 'food' | 'drinks' | 'done'

interface AttendeeForm {
  first_name: string
  last_name: string
  food_preference: string
  allergy_notes: string
  drinks_preference: string
  drinks_notes: string
}

export default function RSVPScreen({ guest, guestName, onComplete, active }: Props) {
  const [step, setStep] = useState<Step>('decision')
  const [loading, setLoading] = useState(false)
  const [attendees, setAttendees] = useState<AttendeeForm[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) setTimeout(() => setVisible(true), 100)
    else setVisible(false)
  }, [active])

  // Build initial attendees from guest record
  useEffect(() => {
    if (!active) return
    const initial: AttendeeForm[] = []
    initial.push({ first_name: guest.first_name, last_name: guest.last_name || '', food_preference: '', allergy_notes: '', drinks_preference: '', drinks_notes: '' })
    if (guest.partner_name) {
      initial.push({ first_name: guest.partner_name, last_name: '', food_preference: '', allergy_notes: '', drinks_preference: '', drinks_notes: '' })
    }
    setAttendees(initial)
  }, [active, guest])

  const handleYes = () => {
    trackEvent(guest.id, '', 'rsvp_started')
    setStep('attendees')
  }

  const handleNo = async () => {
    setLoading(true)
    trackEvent(guest.id, '', 'rsvp_declined')
    await submitRSVP(guest.id, 'declined', 0)
    setLoading(false)
    onComplete('declined')
  }

  const handleAddGuest = () => {
    setAttendees(prev => [...prev, { first_name: '', last_name: '', food_preference: '', allergy_notes: '', drinks_preference: '', drinks_notes: '' }])
  }

  const updateAttendee = (idx: number, field: keyof AttendeeForm, value: string) => {
    setAttendees(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const removeAttendee = (idx: number) => {
    if (attendees.length <= 1) return
    setAttendees(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    setLoading(true)
    trackEvent(guest.id, '', 'rsvp_attending')
    const rsvp = await submitRSVP(guest.id, 'attending', attendees.length)
    if (rsvp) {
      await savePreferences(
        guest.id,
        rsvp.id,
        attendees.map(a => ({ first_name: a.first_name, last_name: a.last_name })),
        attendees.map(a => ({
          food_preference: a.food_preference,
          allergy_notes: a.allergy_notes,
          drinks_preference: a.drinks_preference,
          drinks_notes: a.drinks_notes,
        }))
      )
    }
    setLoading(false)
    onComplete('attending')
  }

  return (
    <div className="w-full h-dvh overflow-y-auto overscroll-contain bg-[#050D1A] safe-top safe-bottom">
      <div className={`min-h-dvh flex flex-col px-6 py-12 max-w-sm mx-auto transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>

        {/* ── DECISION STEP ── */}
        {step === 'decision' && (
          <div className="flex flex-col items-center text-center my-auto">
            <div className="flame-animate text-4xl mb-10 text-amber-400" style={{ filter: 'drop-shadow(0 0 16px rgba(232,129,10,0.7))' }}>◆</div>

            <h2 className="font-serif text-3xl font-bold text-[#F5ECD7] mb-3 leading-tight">
              We'd love to celebrate<br />with you.
            </h2>
            <p className="font-sans text-xs tracking-[0.25em] uppercase text-[#C9A84C]/50 mb-12">
              {EVENT.date} · {EVENT.city}
            </p>

            <p className="font-sans text-sm text-[#F5ECD7]/50 mb-8 tracking-wide">
              Will you be joining us?
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleYes}
                className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase"
              >
                Yes, I'll be there
              </button>
              <button
                onClick={handleNo}
                disabled={loading}
                className="btn-outline w-full py-4 text-sm tracking-[0.2em] uppercase opacity-60 hover:opacity-100"
              >
                {loading ? 'Saving…' : "Sorry, can't make it"}
              </button>
            </div>
          </div>
        )}

        {/* ── ATTENDEES STEP ── */}
        {step === 'attendees' && (
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <p className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/40 mb-2">Wonderful.</p>
              <h2 className="font-serif text-2xl text-[#F5ECD7]">Who's attending?</h2>
            </div>

            {attendees.map((att, idx) => (
              <div key={idx} className="glass rounded-sm p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <p className="font-sans text-[10px] tracking-widest uppercase text-[#C9A84C]/50">
                    {idx === 0 ? 'You' : `Guest ${idx + 1}`}
                  </p>
                  {idx > 0 && (
                    <button onClick={() => removeAttendee(idx)} className="text-white/20 hover:text-white/50 text-sm">✕</button>
                  )}
                </div>
                <input
                  className="bg-transparent border-b border-[#C9A84C]/15 pb-2 text-[#F5ECD7] text-sm font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/40 transition-colors"
                  placeholder="First name"
                  value={att.first_name}
                  onChange={e => updateAttendee(idx, 'first_name', e.target.value)}
                />
                <input
                  className="bg-transparent border-b border-[#C9A84C]/15 pb-2 text-[#F5ECD7] text-sm font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/40 transition-colors"
                  placeholder="Last name"
                  value={att.last_name}
                  onChange={e => updateAttendee(idx, 'last_name', e.target.value)}
                />
              </div>
            ))}

            <button
              onClick={handleAddGuest}
              className="flex items-center gap-2 font-sans text-xs tracking-[0.2em] uppercase text-[#C9A84C]/40 hover:text-[#C9A84C]/70 transition-colors py-2"
            >
              <span>+</span> Add Guest
            </button>

            <button onClick={() => setStep('food')} className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase mt-4">
              Continue
            </button>
          </div>
        )}

        {/* ── FOOD STEP ── */}
        {step === 'food' && (
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <p className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/40 mb-2">Almost done.</p>
              <h2 className="font-serif text-2xl text-[#F5ECD7]">Food</h2>
            </div>

            {attendees.map((att, idx) => (
              <div key={idx} className="glass rounded-sm p-4 flex flex-col gap-4">
                <p className="font-sans text-xs text-[#C9A84C]/60">{att.first_name || `Guest ${idx + 1}`}</p>

                <div className="grid grid-cols-2 gap-2">
                  {['Vegetarian', 'Jain', 'Non-Vegetarian', 'Other'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateAttendee(idx, 'food_preference', opt.toLowerCase())}
                      className={`py-3 px-3 border rounded-sm font-sans text-xs tracking-wide transition-all duration-200 ${
                        att.food_preference === opt.toLowerCase()
                          ? 'border-[#C9A84C]/60 text-[#C9A84C] bg-[#C9A84C]/5'
                          : 'border-white/10 text-white/40 hover:border-white/25'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <input
                  className="bg-transparent border-b border-[#C9A84C]/15 pb-2 text-[#F5ECD7] text-sm font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/40 transition-colors"
                  placeholder="Anything we should know?"
                  value={att.allergy_notes}
                  onChange={e => updateAttendee(idx, 'allergy_notes', e.target.value)}
                />
              </div>
            ))}

            <button onClick={() => setStep('drinks')} className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase mt-4">
              Continue
            </button>
          </div>
        )}

        {/* ── DRINKS STEP ── */}
        {step === 'drinks' && (
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <p className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#C9A84C]/40 mb-2">One last thing.</p>
              <h2 className="font-serif text-2xl text-[#F5ECD7]">Drinks</h2>
            </div>

            {attendees.map((att, idx) => (
              <div key={idx} className="glass rounded-sm p-4 flex flex-col gap-4">
                <p className="font-sans text-xs text-[#C9A84C]/60">{att.first_name || `Guest ${idx + 1}`}</p>

                <div className="flex gap-2">
                  {['Yes', 'No', 'Maybe'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateAttendee(idx, 'drinks_preference', opt.toLowerCase())}
                      className={`flex-1 py-3 border rounded-sm font-sans text-xs tracking-wide transition-all duration-200 ${
                        att.drinks_preference === opt.toLowerCase()
                          ? 'border-[#C9A84C]/60 text-[#C9A84C] bg-[#C9A84C]/5'
                          : 'border-white/10 text-white/40 hover:border-white/25'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <input
                  className="bg-transparent border-b border-[#C9A84C]/15 pb-2 text-[#F5ECD7] text-sm font-sans placeholder-white/20 outline-none focus:border-[#C9A84C]/40 transition-colors"
                  placeholder="Any preference?"
                  value={att.drinks_notes}
                  onChange={e => updateAttendee(idx, 'drinks_notes', e.target.value)}
                />
              </div>
            ))}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full py-4 text-sm tracking-[0.2em] uppercase mt-4"
            >
              {loading ? 'Saving…' : "Confirm Attendance"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
