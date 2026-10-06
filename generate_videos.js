#!/usr/bin/env node
// =============================================
// VIPUL VIDEO GENERATION PIPELINE
// Run: node generate_videos.js
//
// Requirements:
//   npm install node-fetch form-data
//   Set your API keys below
// =============================================

const fs = require('fs');
const path = require('path');

// =============================================
// YOUR API KEYS — Set these
// =============================================
const ELEVENLABS_API_KEY = 'YOUR_ELEVENLABS_API_KEY';   // elevenlabs.io
const ELEVENLABS_VOICE_ID = 'YOUR_VIPUL_VOICE_ID';      // After cloning Vipul's voice
const HEYGEN_API_KEY = 'YOUR_HEYGEN_API_KEY';           // heygen.com
const HEYGEN_AVATAR_ID = 'YOUR_VIPUL_AVATAR_ID';        // After creating Vipul's avatar

// =============================================
// LOAD SCRIPTS
// =============================================
const data = JSON.parse(fs.readFileSync('./scripts.json', 'utf8'));
const guests = data.guests;

// =============================================
// STEP 1: Generate Voice Audio via ElevenLabs
// =============================================
async function generateVoiceAudio(guestId, script) {
  console.log(`\n🎙️ Generating voice for: ${guests[guestId].name}`);

  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    console.error(`❌ ElevenLabs error for ${guestId}:`, await response.text());
    return null;
  }

  const audioPath = `./output/audio_${guestId}.mp3`;
  fs.mkdirSync('./output', { recursive: true });
  const buffer = await response.buffer();
  fs.writeFileSync(audioPath, buffer);
  console.log(`   ✅ Audio saved: ${audioPath}`);
  return audioPath;
}

// =============================================
// STEP 2: Generate Video via HeyGen
// =============================================
async function generateHeyGenVideo(guestId, audioPath) {
  console.log(`\n🎬 Generating HeyGen video for: ${guests[guestId].name}`);

  const fetch = (await import('node-fetch')).default;
  const FormData = (await import('form-data')).default;

  // Create video with Vipul's avatar + ElevenLabs audio
  const createRes = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: HEYGEN_AVATAR_ID,
          avatar_style: 'normal'
        },
        voice: {
          type: 'audio',
          audio_url: `YOUR_AUDIO_CDN_URL/audio_${guestId}.mp3`
          // OR use ElevenLabs voice directly:
          // type: 'elevenlabs',
          // voice_id: ELEVENLABS_VOICE_ID,
          // input_text: guests[guestId].script
        },
        background: {
          type: 'image',
          url: 'YOUR_PARTY_BACKGROUND_IMAGE_URL'
        }
      }],
      dimension: { width: 720, height: 1280 },  // Vertical 9:16 for mobile
      test: false
    })
  });

  const createData = await createRes.json();
  if (!createData.data?.video_id) {
    console.error(`❌ HeyGen create error:`, createData);
    return;
  }

  const videoId = createData.data.video_id;
  console.log(`   ⏳ Video queued. ID: ${videoId}`);

  // Poll for completion
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
    
    const statusRes = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY }
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    console.log(`   Status: ${status} (attempt ${++attempts})`);

    if (status === 'completed') {
      const videoUrl = statusData.data.video_url;
      console.log(`   ✅ Video ready: ${videoUrl}`);
      
      // Download and save
      const videoRes = await fetch(videoUrl);
      const videoPath = `./output/video_${guestId}.mp4`;
      const videoBuffer = await videoRes.buffer();
      fs.writeFileSync(videoPath, videoBuffer);
      console.log(`   💾 Saved: ${videoPath}`);
      return videoPath;
    }

    if (status === 'failed') {
      console.error(`   ❌ Video generation failed for ${guestId}`);
      return null;
    }
  }
}

// =============================================
// MAIN — Run for all guests
// =============================================
async function main() {
  console.log('🚀 Starting Video Generation Pipeline...');
  console.log(`📋 Processing ${Object.keys(guests).length} guests\n`);

  for (const [guestId, guest] of Object.entries(guests)) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`👤 Guest: ${guest.name} (${guestId})`);
    console.log(`📝 Script: ${guest.script.substring(0, 80)}...`);

    // Step 1: Generate voice
    const audioPath = await generateVoiceAudio(guestId, guest.script);
    if (!audioPath) continue;

    // Step 2: Generate video
    await generateHeyGenVideo(guestId, audioPath);
    
    // Rate limit — wait between guests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n✅ All videos generated in: ./output/');
  console.log('📁 Upload these MP4 files to: Supabase Storage or Cloudinary');
  console.log('🔗 Then update guests database with video URLs');
}

main().catch(console.error);
