// Event + venue configuration — all configurable without code changes
export const EVENT = {
  name:    process.env.NEXT_PUBLIC_EVENT_NAME    || 'Arpit @ 40 × Diwali',
  date:    process.env.NEXT_PUBLIC_EVENT_DATE    || '23 October 2026',
  city:    process.env.NEXT_PUBLIC_EVENT_CITY    || 'Jaipur',
  venue:   process.env.NEXT_PUBLIC_EVENT_VENUE   || 'Jaipur (Venue details to follow)',
  contact: process.env.NEXT_PUBLIC_RSVP_CONTACT  || 'Vipul',
  phone:   process.env.NEXT_PUBLIC_RSVP_PHONE    || '+919414036060',
  videoUrl: process.env.NEXT_PUBLIC_VIDEO_URL || '/videos/teaser.mp4',  // default video
  audioUrl: process.env.NEXT_PUBLIC_AUDIO_URL || '/audio/music.mp3',   // custom background music
  poster:   process.env.NEXT_PUBLIC_VIDEO_POSTER || '',
  calDate: '20261023',      // YYYYMMDD for ICS
  calStart: '20261023T190000',
  calEnd:   '20261023T230000',
}

export const WHATSAPP_URL = `https://wa.me/${EVENT.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
  `Hi ${EVENT.contact}! I just RSVPed for Arpit's 40th & Diwali celebration. See you on ${EVENT.date}! 🎂🪔`
)}`

export function buildGoogleCalUrl() {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(EVENT.name)}&dates=${EVENT.calStart}/${EVENT.calEnd}&location=${encodeURIComponent(EVENT.venue)}&details=${encodeURIComponent(`You are invited to ${EVENT.name} — ${EVENT.date}, ${EVENT.city}`)}`
}

export function buildICSContent() {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Arpit40//Invitation//EN
BEGIN:VEVENT
DTSTART:${EVENT.calStart}
DTEND:${EVENT.calEnd}
SUMMARY:${EVENT.name}
DESCRIPTION:You are invited to ${EVENT.name}
LOCATION:${EVENT.venue}
END:VEVENT
END:VCALENDAR`
}
