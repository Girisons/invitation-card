// =============================================
// GOOGLE APPS SCRIPT
// Yeh Google Sheet mein lagao:
// Extensions → Apps Script → Paste karo → Save → Run
// =============================================

// =============================================
// SHEET STRUCTURE (Column Mapping)
// =============================================
const COL = {
  NAME:         1,   // A - Guest ka naam
  PHONE:        2,   // B - WhatsApp number (+91XXXXXXXXXX)
  RELATION:     3,   // C - uncle / auntie / friend / colleague
  INVITE_TYPE:  4,   // D - birthday / diwali / general
  TONE:         5,   // E - formal / friendly
  LANGUAGE:     6,   // F - english / hindi (future use)
  LINK:         7,   // G - Auto-generated WhatsApp link
  STATUS:       8,   // H - pending / sent / opened / rsvp_yes / rsvp_no
  RSVP:         9,   // I - RSVP response from guest
  SENT_AT:     10,   // J - Timestamp when WhatsApp sent
  OPENED_AT:   11,   // K - When guest opened the link (via webhook)
  NOTES:       12    // L - Any extra notes
};

const SHEET_NAME = "Guests";
const WEB_APP_URL = "https://khandelwalinvite.vercel.app"; // Your Vercel URL

// =============================================
// SCRIPT TEMPLATES
// Edit karo yahan — Vipul ki awaaz mein kya bolna hai
// =============================================
const SCRIPTS = {

  birthday: {
    formal: {
      uncle:    "Respected {NAME}, warm greetings to you and the entire family. This is Vipul speaking. My elder brother Arpit is celebrating his 40th birthday on the 23rd of October, and we would be truly honoured by your blessings and presence at this grand celebration. Please do save the date.",
      auntie:   "Respected {NAME}, warmest greetings. This is Vipul. We are celebrating Arpit's 40th birthday milestone on the 23rd of October and your gracious presence would make the evening truly special. We eagerly look forward to welcoming you.",
      colleague: "Hello {NAME}, this is Vipul Khandelwal. I am personally reaching out to invite you to my brother Arpit's 40th birthday celebration on the 23rd of October. It will be a grand evening and we would be delighted to have you join us.",
      friend:   "Hey {NAME}! Vipul here. My brother Arpit is turning 40 on October 23rd and we are throwing an incredible party. You have to be there. Save the date right now!"
    },
    friendly: {
      uncle:    "Pranam {NAME}! Vipul here! Bhaiya Arpit's big 40th is on October 23rd and it's going to be an amazing celebration. Your blessings and presence would mean everything to us. Please do come!",
      auntie:   "Pranam {NAME}! Yeh Vipul bol raha hoon. Bhaiya Arpit ka 40th birthday grand celebration hai 23 October ko. Aapka aana bohot zaroori hai. Please zaroor aayein!",
      colleague: "Hi {NAME}! Vipul here. Quick heads up — Arpit's turning 40 on October 23rd and we are having a big celebration. Would love to have you there. Do save the date!",
      friend:   "Arre {NAME} yaar! Vipul here! Arpit bhai ka 40th bash hai October 23rd ko! Full party mode — DJ, drinks, great food. Block the date bhai, you absolutely cannot miss this!"
    }
  },

  diwali: {
    formal: {
      uncle:    "Respected {NAME}, warm Diwali greetings from the Khandelwal family. This is Vipul. We would be deeply honoured to have you celebrate this auspicious festival with us. Please join us for our Diwali gathering and let us mark this beautiful occasion together.",
      auntie:   "Respected {NAME}, Shubh Deepawali! This is Vipul from the Khandelwal family. We are warmly inviting you to our Diwali celebration and would be truly blessed to have you with us.",
      colleague: "Hello {NAME}, Diwali greetings! This is Vipul Khandelwal. On behalf of our family, I would like to warmly invite you to our Diwali celebration. We hope you can join us for this festive occasion.",
      friend:   "Happy Diwali {NAME}! Vipul here! Come join the Khandelwal Diwali party — lights, sweets, fireworks and great fun. You are invited!"
    },
    friendly: {
      uncle:    "Pranam {NAME}! Shubh Deepawali! Yeh Vipul bol raha hoon. Hamare ghar Diwali ka bahut bada celebration hai aur aapka aashirwaad aur presence hamare liye sabse important hai. Zaroor padhaarein!",
      auntie:   "Pranam {NAME}! Happy Diwali! Yeh Vipul hoon. Hamare ghar ki Diwali aapke bina adhoori hai. Aap zaroor aayein!",
      colleague: "Hey {NAME}! Happy Diwali! Vipul here! Joining us for our Diwali bash? Great food, sweets, and celebrations. Hope to see you there!",
      friend:   "Yaar {NAME}! Happy Diwali! Vipul here — Diwali party at our place, full dhamaka mode! Lights, masti, sweets. Come na bhai!"
    }
  },

  general: {
    formal: {
      default: "Hello {NAME}, this is Vipul Khandelwal. I am reaching out with a special invitation for you. Please tap below to view the full details of this exclusive event."
    },
    friendly: {
      default: "Hey {NAME}! Vipul here! Got something special for you — check out this exclusive invite I have put together just for you!"
    }
  }
};

// =============================================
// GENERATE PERSONALIZED LINK FOR EACH GUEST
// =============================================
// =============================================
// GENERATE PERSONALIZED LINK FOR EACH GUEST
// New Sheet Structure:
// A=S.No, B=Actual Name, C=Spoken Name,
// D=Appko (Remarks), E=Mobile, F=Confirmation
// G=Script (auto-formula), H=WhatsApp Link
// =============================================
function generateGuestLink(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const row   = sheet.getRange(rowIndex, 1, 1, 8).getValues()[0];

  const spokenName = (row[2] || row[1] || 'Guest').toString().trim(); // Col C
  const appko      = (row[3] || '').toString().trim();                 // Col D
  // Extract companion name: "Aur Babhi Ji ko" → "Babhi Ji"
  const companion  = appko.replace(/^Aur\s+/i,'').replace(/\s+ko$/i,'').trim();

  // SHORT clean URL — no script in URL!
  const url = WEB_APP_URL
    + '?name=' + encodeURIComponent(spokenName)
    + '&with=' + encodeURIComponent(companion)
    + '&id=guest_' + rowIndex;

  return url;
}




// =============================================
// GENERATE ALL LINKS (Run this first)
// =============================================
function generateAllLinks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  for (let i = 2; i <= lastRow; i++) {
    const link = generateGuestLink(i);
    sheet.getRange(i, COL.LINK).setValue(link);
    sheet.getRange(i, COL.STATUS).setValue('pending');
  }

  SpreadsheetApp.getUi().alert(`✅ Links generated for ${lastRow - 1} guests!`);
}

// =============================================
// SEND WHATSAPP TO ONE ROW
// =============================================
function sendWhatsAppToRow(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const row = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];

  const name        = row[COL.NAME - 1];
  const phone       = String(row[COL.PHONE - 1]).replace(/\D/g, ''); // digits only
  const inviteType  = (row[COL.INVITE_TYPE - 1] || 'birthday').toLowerCase();
  const tone        = (row[COL.TONE - 1] || 'formal').toLowerCase();
  const link        = row[COL.LINK - 1];

  if (!phone || !link) {
    Logger.log(`Skipping row ${rowIndex}: missing phone or link`);
    return;
  }

  // WhatsApp message text
  const messages = {
    birthday: {
      formal:   `🎬 A special movie-style invitation has been created for you.\n\nPlease tap to view your personalized invite:\n${link}`,
      friendly: `🎉 Arre ${name}! Check out this special invite made just for you! 🎬\n\n👉 ${link}`
    },
    diwali: {
      formal:   `🪔 A special Diwali invitation has been created for you.\n\nPlease tap to view:\n${link}`,
      friendly: `🪔 Happy Diwali ${name}! Ek khaas invite hai aapke liye! 🎆\n\n👉 ${link}`
    },
    general: {
      formal:   `You have received a special exclusive invitation.\n\n👉 ${link}`,
      friendly: `Hey ${name}! Got a special invite for you! 👉 ${link}`
    }
  };

  const message = (messages[inviteType] || messages.general)[tone] || messages.general.formal;
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  // Open WhatsApp link in browser
  // Note: Google Apps Script can't auto-send WhatsApp — opens web link for you to click send
  const html = HtmlService.createHtmlOutput(
    `<script>window.open('${whatsappUrl}', '_blank'); google.script.host.close();</script>`
  );
  SpreadsheetApp.getUi().showModalDialog(html, `Opening WhatsApp for ${name}...`);

  // Update sheet
  sheet.getRange(rowIndex, COL.STATUS).setValue('sent');
  sheet.getRange(rowIndex, COL.SENT_AT).setValue(new Date().toLocaleString('en-IN'));
}

// =============================================
// SEND TO ALL PENDING GUESTS (Bulk)
// =============================================
function sendToAllPending() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  let sentCount = 0;

  for (let i = 2; i <= lastRow; i++) {
    const status = sheet.getRange(i, COL.STATUS).getValue();
    if (status === 'pending' || status === '') {
      sendWhatsAppToRow(i);
      sentCount++;
      Utilities.sleep(1500); // small delay between each
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Opened WhatsApp for ${sentCount} guests. Click Send on each one.`);
}

// =============================================
// GET SCRIPT FOR GUEST (used by web app via API)
// =============================================
function doGet(e) {
  const guestId   = e.parameter.id || '';
  const inviteType = (e.parameter.type || 'birthday').toLowerCase();
  const tone       = (e.parameter.tone || 'formal').toLowerCase();
  const relation   = (e.parameter.rel || 'friend').toLowerCase();
  const name       = e.parameter.name || 'Guest';

  const typeScripts = SCRIPTS[inviteType] || SCRIPTS.birthday;
  const toneScripts = typeScripts[tone] || typeScripts.formal;
  const script = (toneScripts[relation] || toneScripts.friend || toneScripts.default || '')
                  .replace(/{NAME}/g, name);

  const result = {
    guest_id:    guestId,
    name:        name,
    invite_type: inviteType,
    tone:        tone,
    relation:    relation,
    script:      script,
    salutation:  getSalutation(name, relation, tone)
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSalutation(name, relation, tone) {
  if (tone === 'friendly') {
    if (relation === 'uncle') return `Pranam ${name} Ji! 🙏`;
    if (relation === 'auntie') return `Pranam ${name} Ji! ✨`;
    return `Hey ${name}! 🎉`;
  }
  if (relation === 'uncle' || relation === 'auntie') return `Respected ${name} 🙏`;
  return `Dear ${name}`;
}

// =============================================
// UPDATE RSVP (called from web app webhook)
// =============================================
function updateRSVP(guestId, response) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  for (let i = 2; i <= lastRow; i++) {
    const link = sheet.getRange(i, COL.LINK).getValue();
    if (link.includes(guestId)) {
      sheet.getRange(i, COL.STATUS).setValue(response === 'yes' ? 'rsvp_yes' : 'rsvp_no');
      sheet.getRange(i, COL.RSVP).setValue(response === 'yes' ? '✅ Attending' : '❌ Not Attending');
      break;
    }
  }
}

// =============================================
// ADD CUSTOM MENU TO GOOGLE SHEET
// =============================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎬 Birthday Invites')
    .addItem('📎 Generate All Links', 'generateAllLinks')
    .addSeparator()
    .addItem('📤 Send WhatsApp to All Pending', 'sendToAllPending')
    .addSeparator()
    .addItem('📊 Refresh Status', 'refreshStatus')
    .addToUi();
}

function refreshStatus() {
  SpreadsheetApp.getUi().alert('Status refreshed! RSVP updates come automatically from the web app.');
}
