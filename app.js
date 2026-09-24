// Mock Database (Simulating secure Google Drive database)
const GUEST_DATABASE = {
  "guest_001": {
    name: "Ramesh Uncle",
    salutation: "Respected Ramesh Uncle 🙏",
    relation: "uncle",
    script: "Respected Ramesh Uncle, warm greetings! This is Vipul speaking to you live from our celebration venue! My elder brother Arpit is turning 40 on the 23rd of October, and this milestone celebration is incomplete without your blessings and presence. Please save the date... We eagerly look forward to welcoming you!"
  },
  "guest_002": {
    name: "Sunita Auntie",
    salutation: "Respected Sunita Auntie ✨",
    relation: "auntie",
    script: "Respected Sunita Auntie, warmest greetings! This is Vipul broadcasting live from the party stage! We are hosting a grand 40th birthday celebration for my beloved brother Arpit on October 23rd. The music, lights, and luxury venue are all ready. Please save the date!"
  },
  "guest_003": {
    name: "Vikram Ji",
    salutation: "Hello Vikram! 🎉",
    relation: "friend",
    script: "Hello Vikram! Vipul here, live from the party zone! My elder brother Arpit is hitting his big 40th milestone on October 23rd! It is going to be a blockbuster night with great music, drinks, and personalized reels. Lock in the date right now!"
  },
  "guest_004": {
    name: "Priya Sharma",
    salutation: "Dear Priya Ji 💫",
    relation: "guest",
    script: "Dear Priya Ji, warm greetings! Vipul here from the event venue! We are organizing a grand blockbuster celebration for Arpit's 40th Birthday on October 23rd. Mark your calendar for an unforgettable evening. Save the date!"
  }
};

let currentGuestId = "guest_001";
let speechSynthUtterance = null;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  const guestSelect = document.getElementById("guest-select");
  guestSelect.addEventListener("change", (e) => {
    currentGuestId = e.target.value;
    updateGuestDetails();
  });

  document.getElementById("btn-start-teaser").addEventListener("click", () => {
    switchScreen("screen-video");
    playVipulMovieScene();
  });

  document.getElementById("btn-skip-video").addEventListener("click", () => {
    stopSpeech();
    switchScreen("screen-card");
  });

  document.getElementById("btn-rsvp-yes").addEventListener("click", () => {
    const btn = document.getElementById("btn-rsvp-yes");
    btn.innerHTML = "✨ RSVP Confirmed! See you Oct 23! 🎉";
    btn.style.background = "linear-gradient(135deg, #00b09b, #96c93d)";
    btn.style.color = "#fff";
  });

  document.getElementById("btn-add-calendar").addEventListener("click", () => {
    alert(`📅 Event saved to calendar for ${GUEST_DATABASE[currentGuestId].name}!\n\nEvent: Arpit Khandelwal 40th Birthday\nDate: 23rd October 2026\nLocation: Grand Palace Club`);
  });

  updateGuestDetails();
}

function updateGuestDetails() {
  const guest = GUEST_DATABASE[currentGuestId];
  document.getElementById("intro-greeting").innerText = guest.salutation;
  document.getElementById("card-guest-name").innerText = `Personalized for ${guest.name}`;
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen-view").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

let walkSceneTimer = null;

function playVipulMovieScene() {
  const guest = GUEST_DATABASE[currentGuestId];
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
    
    // Animate Vipul moving from VIP Lounge to Main Party Stage
    walkingFrame.src = "assets/vipul_walk_1.jpg";
    if (partyLocTag) partyLocTag.innerText = "📍 VIP LOUNGE • WALKING TO STAGE";

    clearInterval(walkSceneTimer);
    walkSceneTimer = setTimeout(() => {
      walkingFrame.style.opacity = "0.4";
      setTimeout(() => {
        walkingFrame.src = "assets/vipul_walk_2.jpg";
        walkingFrame.style.opacity = "1";
        if (partyLocTag) partyLocTag.innerText = "📍 MAIN PARTY STAGE • INVITING GUEST";
      }, 400);
    }, 4500);

    if ('speechSynthesis' in window) {
      speechSynthUtterance = new SpeechSynthesisUtterance(guest.script);
      speechSynthUtterance.rate = 0.95;
      speechSynthUtterance.pitch = 1.0;
      speechSynthUtterance.lang = 'en-US';

      speechSynthUtterance.onend = () => {
        clearInterval(walkSceneTimer);
        setTimeout(() => {
          switchScreen("screen-card");
        }, 1200);
      };

      window.speechSynthesis.speak(speechSynthUtterance);
    }
  });
}

function stopSpeech() {
  clearInterval(walkSceneTimer);
  const videoContainer = document.getElementById("video-container");
  if (videoContainer) videoContainer.classList.remove("talking-active");
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
