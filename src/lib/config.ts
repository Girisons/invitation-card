// Event + venue configuration — all configurable without code changes
export const EVENT = {
  name:    process.env.NEXT_PUBLIC_EVENT_NAME    || "Arpit's 40 & Diwali Bash",
  date:    process.env.NEXT_PUBLIC_EVENT_DATE    || 'Friday, 23 October 2026',
  time:    '8:00 PM Onwards',
  city:    process.env.NEXT_PUBLIC_EVENT_CITY    || 'Jaipur',
  venue:   process.env.NEXT_PUBLIC_EVENT_VENUE   || 'The Foothills Villas, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur',
  venueName: 'The Foothills Villas',
  venueAddress: 'Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Foothills+Villas+Near+Rajasthali+Resort+Kukas+Delhi+Road+Jaipur',
  contact: process.env.NEXT_PUBLIC_RSVP_CONTACT  || 'Tanvi',
  phone:   process.env.NEXT_PUBLIC_RSVP_PHONE    || '+919460922322',
  videoUrl: process.env.NEXT_PUBLIC_VIDEO_URL || '/videos/teaser.mp4',  // default video
  audioUrl: process.env.NEXT_PUBLIC_AUDIO_URL || '/audio/music.mp3',   // custom background music
  poster:   process.env.NEXT_PUBLIC_VIDEO_POSTER || '',
  calDate: '20261023',      // YYYYMMDD for ICS
  calStart: '20261023T200000', // 8:00 PM
  calEnd:   '20261024T020000', // 2:00 AM next morning
}

export const DIWALI_EVENT = {
  name: 'Grand Diwali Party Celebration',
  contact: 'Vipul Khandelwal',
  phone: process.env.NEXT_PUBLIC_DIWALI_RSVP_PHONE || '+919414036060',
  venue: 'The Foothills Villas, Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur',
  venueName: 'The Foothills Villas',
  venueAddress: 'Near Rajasthali Resort & Spa, Kukas, Delhi Road, Jaipur',
  time: '8:00 PM Onwards',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Foothills+Villas+Near+Rajasthali+Resort+Kukas+Delhi+Road+Jaipur',
}

export const WHATSAPP_URL = `https://wa.me/${EVENT.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
  `Hi ${EVENT.contact}! I just RSVPed for Arpit's 40th & Diwali celebration. See you on ${EVENT.date}! 🎂🪔`
)}`

export function buildGoogleCalUrl(isDiwali?: boolean) {
  const eventName = isDiwali ? 'Grand Diwali Party Celebration' : EVENT.name
  const details = isDiwali
    ? 'You are warmly invited to the Grand Diwali Party Celebration by the Khandelwal Family — Friday, 23 October 2026, Jaipur.'
    : `You are invited to ${EVENT.name} — ${EVENT.date}, ${EVENT.city}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName)}&dates=${EVENT.calStart}/${EVENT.calEnd}&location=${encodeURIComponent(EVENT.venue)}&details=${encodeURIComponent(details)}`
}

export function buildICSContent(isDiwali?: boolean) {
  const eventName = isDiwali ? 'Grand Diwali Party Celebration' : EVENT.name
  const description = isDiwali
    ? 'You are warmly invited to the Grand Diwali Party Celebration by the Khandelwal Family.'
    : `You are invited to ${EVENT.name}`
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Khandelwal//Invitation//EN
BEGIN:VEVENT
DTSTART:${EVENT.calStart}
DTEND:${EVENT.calEnd}
SUMMARY:${eventName}
DESCRIPTION:${description}
LOCATION:${EVENT.venue}
END:VEVENT
END:VCALENDAR`
}
