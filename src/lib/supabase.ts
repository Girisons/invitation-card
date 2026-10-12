import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  _client = createClient(url, key)
  return _client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getClient() as any)[prop] }
})

// Types
export interface Guest {
  id: string
  invite_code: string
  first_name: string
  last_name?: string
  nickname?: string
  partner_name?: string
  partner_mobile?: string
  mobile?: string
  email?: string
  guest_of?: string
  relationship_group?: string
  invited_count: number
  invitation_status: string
  food_preference?: string
  liquor_preference?: string
  linked_guest_id?: string
  send_together?: boolean
  video_url?: string
  std_video_url?: string
}

export interface RSVP {
  id: string
  guest_id: string
  status: 'pending' | 'attending' | 'declined'
  number_attending: number
  submitted_at: string
}

export interface Attendee {
  id: string
  rsvp_id: string
  guest_id: string
  first_name: string
  last_name?: string
  relationship?: string
  age_category?: string
}

export interface Preference {
  id: string
  attendee_id: string
  guest_id: string
  food_preference?: string
  allergy_notes?: string
  drinks_preference?: string
  drinks_notes?: string
  special_notes?: string
}

// Fetch guest by invite code
export async function getGuestByCode(code: string): Promise<Guest | null> {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (error || !data) return null

  if (data.linked_guest_id) {
    const { data: partner } = await supabase
      .from('guests')
      .select('first_name, nickname')
      .eq('id', data.linked_guest_id)
      .single()

    if (partner) {
      const partnerDisplay = (partner.nickname && partner.nickname.trim())
        ? partner.nickname.trim()
        : (partner.first_name || '').trim().split(' ')[0]
      if (partnerDisplay) {
        data.partner_name = partnerDisplay
      }
    }
  }

  return data
}

// Track event
export async function trackEvent(
  guestId: string | null,
  inviteCode: string,
  eventType: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from('events').insert({
    guest_id: guestId,
    invite_code: inviteCode,
    event_type: eventType,
    metadata: metadata || {},
  })
}

// Update guest status
export async function updateGuestStatus(guestId: string, status: string) {
  await supabase
    .from('guests')
    .update({ invitation_status: status })
    .eq('id', guestId)
}

// Submit RSVP
export async function submitRSVP(
  guestId: string,
  status: 'attending' | 'declined',
  numberAttending: number
): Promise<RSVP | null> {
  // Update invitation_status directly on guests table
  await supabase
    .from('guests')
    .update({ invitation_status: status })
    .eq('id', guestId)

  // If linked partner guest exists and send_together, update partner as well
  const { data: g } = await supabase
    .from('guests')
    .select('linked_guest_id, send_together')
    .eq('id', guestId)
    .single()

  if (g && g.linked_guest_id && g.send_together) {
    await supabase
      .from('guests')
      .update({ invitation_status: status })
      .eq('id', g.linked_guest_id)
  }

  // Check for existing RSVP
  const { data: existing } = await supabase
    .from('rsvps')
    .select('*')
    .eq('guest_id', guestId)
    .single()

  if (existing) {
    const { data } = await supabase
      .from('rsvps')
      .update({ status, number_attending: numberAttending, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    return data
  }

  const { data } = await supabase
    .from('rsvps')
    .insert({ guest_id: guestId, status, number_attending: numberAttending })
    .select()
    .single()
  return data
}

// Save preferences
export async function savePreferences(
  guestId: string,
  rsvpId: string,
  attendees: Partial<Attendee>[],
  prefs: Partial<Preference>[]
) {
  // Insert attendees
  const attendeeResults = []
  for (let i = 0; i < attendees.length; i++) {
    const { data } = await supabase
      .from('attendees')
      .insert({ ...attendees[i], rsvp_id: rsvpId, guest_id: guestId })
      .select()
      .single()
    if (data) attendeeResults.push(data)
  }

  // Insert preferences
  for (let i = 0; i < attendeeResults.length; i++) {
    if (prefs[i]) {
      await supabase.from('preferences').insert({
        ...prefs[i],
        attendee_id: attendeeResults[i].id,
        guest_id: guestId,
      })
    }
  }

  return attendeeResults
}
