// =============================================
// SUPABASE CONFIG
// =============================================
const SUPABASE_URL = 'https://dytnhiwxjmmfcolfnyo.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE'; // anon public key jo abhi copy kiya

// Supabase lightweight client (no npm needed, browser fetch)
const supabase = {
  async from(table) {
    return {
      _table: table,
      _filters: [],
      eq(col, val) { this._filters.push({ col, val }); return this; },
      async select(cols = '*') {
        let url = `${SUPABASE_URL}/rest/v1/${this._table}?select=${cols}`;
        this._filters.forEach(f => { url += `&${f.col}=eq.${f.val}`; });
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        const data = await res.json();
        return { data, error: res.ok ? null : data };
      },
      async insert(payload) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${this._table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        return { error: res.ok ? null : await res.json() };
      }
    };
  }
};

// =============================================
// FALLBACK LOCAL DATABASE (jab tak Supabase set nahi hoti)
// =============================================
const LOCAL_GUEST_DB = {
  "guest_001": {
    name: "Ramesh Uncle", salutation: "Respected Ramesh Uncle Ji 🙏", relation: "uncle",
    script: "Respected Ramesh Uncle, warm greetings! This is Vipul speaking to you live from our celebration venue! My elder brother Arpit is turning 40 on the 23rd of October, and this milestone celebration is incomplete without your blessings and presence. Please save the date!"
  },
  "guest_002": {
    name: "Sunita Auntie", salutation: "Respected Sunita Auntie Ji ✨", relation: "auntie",
    script: "Respected Sunita Auntie, warmest greetings! This is Vipul broadcasting live from the party stage! We are hosting a grand 40th birthday celebration for my beloved brother Arpit on October 23rd. Please save the date!"
  },
  "guest_003": {
    name: "Vikram Ji", salutation: "Hello Vikram! 🎉", relation: "friend",
    script: "Hello Vikram! Vipul here, live from the party zone! My elder brother Arpit is hitting his big 40th milestone on October 23rd! Lock in the date right now!"
  },
  "guest_004": {
    name: "Priya Sharma", salutation: "Dear Priya Ji 💫", relation: "colleague",
    script: "Dear Priya Ji, warm greetings! Vipul here from the event venue! We are organizing a grand blockbuster celebration for Arpit's 40th Birthday on October 23rd. Save the date!"
  }
};

// =============================================
// GUEST LOADER — URL param se ya dropdown se
// =============================================
let currentGuest = null;
let speechSynthUtterance = null;
let walkSceneTimer = null;

async function loadGuest(linkId) {
  // 1. URL se link_id lo: ?id=guest_001
  // 2. Supabase se guest fetch karo
  try {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      const { data, error } = await (await supabase.from('guests')).eq('link_id', linkId).select('*');
      if (!error && data && data.length > 0) {
        currentGuest = data[0];
        return currentGuest;
      }
    }
  } catch (e) {
    console.warn('Supabase not configured, using local fallback');
  }
  // Fallback to local DB
  currentGuest = LOCAL_GUEST_DB[linkId] || LOCAL_GUEST_DB['guest_001'];
  return currentGuest;
}

async function saveRSVP(linkId, response) {
  try {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      const { error } = await (await supabase.from('rsvp_responses')).insert({
        link_id: linkId,
        response: response
      });
      if (!error) console.log('✅ RSVP saved to Supabase!');
    }
  } catch (e) {
    console.warn('RSVP save failed, Supabase not configured');
  }
}

// =============================================
// APP INIT
// =============================================
// =============================================
// MOBILE SPEECH UNLOCK
// iOS & Android block speech without user gesture
// =============================================
function unlockSpeechOnMobile() {
  if ('speechSynthesis' in window) {
    // iOS fix: must call speak() with empty utterance first on user gesture
    const unlock = new SpeechSynthesisUtterance('');
    unlock.volume = 0;
    window.speechSynthesis.speak(unlock);
    window.speechSynthesis.cancel();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlGuestId = urlParams.get('id');
  const guestSelect = document.getElementById("guest-select");
  const initialId = urlGuestId || guestSelect.value || 'guest_001';

  if (urlGuestId) {
    const header = document.querySelector('.sim-header');
    if (header) header.style.display = 'none';
  }

  await loadGuest(initialId);
  updateGuestUI();

  guestSelect.addEventListener("change", async (e) => {
    await loadGuest(e.target.value);
    updateGuestUI();
  });

  // Unlock speech on first ANY touch/click (mobile requirement)
  document.addEventListener('touchstart', unlockSpeechOnMobile, { once: true });
  document.addEventListener('click', unlockSpeechOnMobile, { once: true });

  document.getElementById("btn-start-teaser").addEventListener("click", () => {
    unlockSpeechOnMobile(); // ensure speech unlocked on this exact gesture
    switchScreen("screen-video");
    // Small delay lets screen transition complete before speech starts
    setTimeout(() => playVipulMovieScene(), 300);
  });

  document.getElementById("btn-skip-video").addEventListener("click", () => {
    stopSpeech();
    switchScreen("screen-card");
  });

  document.getElementById("btn-rsvp-yes").addEventListener("click", async () => {
    const btn = document.getElementById("btn-rsvp-yes");
    btn.innerHTML = "✨ RSVP Confirmed! See you Oct 23! 🎉";
    btn.style.background = "linear-gradient(135deg, #00b09b, #96c93d)";
    btn.style.color = "#fff";
    await saveRSVP(currentGuest?.link_id || guestSelect.value, 'attending');
  });

  document.getElementById("btn-add-calendar").addEventListener("click", () => {
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Arpit+Khandelwal+40th+Birthday&dates=20261023T190000/20261023T230000&details=Arpit's+Grand+40th+Birthday+Celebration!&location=Grand+Palace+Club`;
    window.open(calUrl, '_blank');
  });
});

// =============================================
// UI UPDATER
// =============================================
function updateGuestUI() {
  if (!currentGuest) return;
  const el = (id) => document.getElementById(id);
  if (el("intro-greeting")) el("intro-greeting").innerText = currentGuest.salutation || `Dear ${currentGuest.name}`;
  if (el("card-guest-name")) el("card-guest-name").innerText = `Personalized for ${currentGuest.name}`;
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen-view").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

// =============================================
// VIDEO PLAYBACK
// =============================================
function playVipulMovieScene() {
  if (!currentGuest) return;
  stopSpeech();

  const mp4Video = document.getElementById("vipul-mp4-video");
  const walkingFrame = document.getElementById("vipul-walking-frame");
  const partyLocTag = document.getElementById("party-loc-tag");

  mp4Video.src = "assets/vipul_walking.mp4";
  mp4Video.play().then(() => {
    mp4Video.style.display = "block";
    walkingFrame.style.display = "none";
    if (partyLocTag) partyLocTag.style.display = "none";
  }).catch(() => {
    mp4Video.style.display = "none";
    walkingFrame.style.display = "block";
    if (partyLocTag) partyLocTag.style.display = "block";

    walkingFrame.src = "vipul_walk_1.jpg";
    if (partyLocTag) partyLocTag.innerText = "📍 VIP LOUNGE • WALKING TO STAGE";

    clearTimeout(walkSceneTimer);
    walkSceneTimer = setTimeout(() => {
      walkingFrame.style.opacity = "0.4";
      setTimeout(() => {
        walkingFrame.src = "vipul_walk_2.jpg";
        walkingFrame.style.opacity = "1";
        if (partyLocTag) partyLocTag.innerText = "📍 MAIN PARTY STAGE • INVITING GUEST";
      }, 400);
    }, 4500);

    if ('speechSynthesis' in window) {
      speechSynthUtterance = new SpeechSynthesisUtterance(currentGuest.script);
      speechSynthUtterance.rate = 0.92;
      speechSynthUtterance.pitch = 0.85;   // Lower pitch = deeper male voice
      speechSynthUtterance.volume = 1.0;
      speechSynthUtterance.lang = 'en-US';

      // Select best available MALE voice
      const setMaleVoice = () => {
        const voices = window.speechSynthesis.getVoices();

        // Priority list of known male voices across browsers/devices
        const maleVoiceNames = [
          'Google UK English Male',      // Chrome desktop
          'Microsoft David',             // Windows Edge/Chrome
          'Microsoft Mark',              // Windows
          'Daniel',                      // iOS/macOS UK male
          'Alex',                        // macOS US male
          'Aaron',                       // macOS US male
          'Fred',                        // macOS
          'Google US English',           // Sometimes male on Android
          'en-US-Wavenet-D',             // Google WaveNet male
          'en-US-Standard-D',            // Google Standard male
          'en-IN-Wavenet-C',             // Indian English male
          'Rishi',                       // iOS Indian English male
        ];

        let selectedVoice = null;

        // Try exact name match first
        for (const name of maleVoiceNames) {
          selectedVoice = voices.find(v => v.name.includes(name));
          if (selectedVoice) break;
        }

        // Fallback: any voice with 'male' in the name
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes('male'));
        }

        // Fallback: any English male-sounding voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('female'));
        }

        if (selectedVoice) {
          speechSynthUtterance.voice = selectedVoice;
          console.log('🎙️ Using voice:', selectedVoice.name);
        }
      };

      // Voices may load async — handle both cases
      if (window.speechSynthesis.getVoices().length > 0) {
        setMaleVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = setMaleVoice;
      }

      speechSynthUtterance.onend = () => {
        clearTimeout(walkSceneTimer);
        setTimeout(() => switchScreen("screen-card"), 1200);
      };

      window.speechSynthesis.speak(speechSynthUtterance);
    }
  });
}

function stopSpeech() {
  clearTimeout(walkSceneTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
