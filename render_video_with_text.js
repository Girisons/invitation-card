const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { execSync } = require('child_process')

const FFMPEG_PATH = "C:\\Users\\Arpit Khandelwal\\AppData\\Local\\Cypress\\Cache\\15.18.1\\Cypress\\resources\\app\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe"
const INPUT_VIDEO = path.join(__dirname, 'public', 'videos', 'Save the date vedio.mp4')
const OUTPUT_VIDEO = path.join(__dirname, 'public', 'videos', 'Save_the_Date_Video_With_Text.mp4')

const svg1 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF6D6"/>
      <stop offset="40%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="30%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="470" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="4" fill="#C9A84C" opacity="0.9">A TIMELESS CELEBRATION</text>
    <text x="288" y="530" font-size="44" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">40 &amp; Festive</text>
    <line x1="228" y1="555" x2="348" y2="555" stroke="#C9A84C" stroke-width="1.5" opacity="0.6"/>
    <text x="288" y="585" font-family="Arial, sans-serif" font-size="14" font-weight="bold" letter-spacing="3" fill="#F5ECD7" opacity="0.9">ARPIT'S 40TH &amp; DIWALI BASH</text>
  </g>
</svg>`

const svg2 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF6D6"/>
      <stop offset="40%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="30%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="460" font-family="Arial, sans-serif" font-size="14" font-weight="bold" letter-spacing="5" fill="#C9A84C" opacity="0.9">SAVE THE DATE</text>
    <text x="288" y="525" font-size="28" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">ARPIT'S 40TH &amp; DIWALI BASH</text>
    <g transform="translate(288, 570)">
      <rect x="-160" y="-18" width="320" height="34" rx="17" fill="#050D1A" fill-opacity="0.85" stroke="#C9A84C" stroke-width="1.5"/>
      <text x="0" y="4" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="2" fill="#F5ECD7">JOIN US TO CELEBRATE 40 YEARS OF LIGHT</text>
    </g>
  </g>
</svg>`

const svg3 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF6D6"/>
      <stop offset="40%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="30%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="450" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="4" fill="#C9A84C" opacity="0.9">DIWALI VIBES • FAB 40 • MEMORIES</text>
    <text x="288" y="515" font-size="30" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">FRIDAY | OCT 23, 2026</text>
    <text x="288" y="555" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="3" fill="#FFFFFF" opacity="0.8">JAIPUR · RAJASTHAN</text>
    <text x="288" y="600" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="3" fill="#C9A84C" opacity="0.7">ARPIT'S 40TH &amp; DIWALI BASH</text>
  </g>
</svg>`

async function main() {
  const overlay1Path = path.join(__dirname, 'overlay1.png')
  const overlay2Path = path.join(__dirname, 'overlay2.png')
  const overlay3Path = path.join(__dirname, 'overlay3.png')

  await sharp(Buffer.from(svg1)).png().toFile(overlay1Path)
  await sharp(Buffer.from(svg2)).png().toFile(overlay2Path)
  await sharp(Buffer.from(svg3)).png().toFile(overlay3Path)

  console.log('PNG overlays generated successfully.')

  // Build FFmpeg command to overlay PNG 1 (0-5s), PNG 2 (5-10s), PNG 3 (10-15s) onto the video
  const filterComplex = `"[0:v][1:v]overlay=0:0:enable='between(t,0,5)'[v1]; [v1][2:v]overlay=0:0:enable='between(t,5,10)'[v2]; [v2][3:v]overlay=0:0:enable='between(t,10,15)'[vout]"`

  const cmd = `"${FFMPEG_PATH}" -y -i "${INPUT_VIDEO}" -i "${overlay1Path}" -i "${overlay2Path}" -i "${overlay3Path}" -filter_complex ${filterComplex} -map "[vout]" -map 0:a? -c:v libx264 -preset fast -crf 20 -c:a copy "${OUTPUT_VIDEO}"`

  console.log('Executing FFmpeg command...')
  execSync(cmd, { stdio: 'inherit' })
  console.log('Video generated successfully at:', OUTPUT_VIDEO)
}

main().catch(console.error)
