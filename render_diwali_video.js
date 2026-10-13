const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { execSync } = require('child_process')

const FFMPEG_PATH = "C:\\Users\\Arpit Khandelwal\\AppData\\Local\\Cypress\\Cache\\15.18.1\\Cypress\\resources\\app\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe"
const INPUT_VIDEO = path.join(__dirname, 'public', 'videos', 'Save the date vedio.mp4')
const OUTPUT_VIDEO = path.join(__dirname, 'public', 'videos', 'save-the-date-diwali.mp4')

const svg1 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF8E1"/>
      <stop offset="35%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="35%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="445" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="4" fill="#C9A84C" opacity="0.95">FESTIVAL OF LIGHTS</text>
    <text x="288" y="510" font-size="46" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">Diwali Party</text>
    <line x1="200" y1="538" x2="376" y2="538" stroke="#C9A84C" stroke-width="1.5" opacity="0.6"/>
    <text x="288" y="570" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="4" fill="#F5ECD7" opacity="0.9">A GRAND CELEBRATION</text>
  </g>
</svg>`

const svg2 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF8E1"/>
      <stop offset="35%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="35%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="440" font-family="Arial, sans-serif" font-size="14" font-weight="bold" letter-spacing="5" fill="#C9A84C" opacity="0.95">SAVE THE DATE</text>
    <text x="288" y="505" font-size="34" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">DIWALI PARTY 2026</text>
    <g transform="translate(288, 555)">
      <rect x="-170" y="-18" width="340" height="36" rx="18" fill="#050D1A" fill-opacity="0.9" stroke="#C9A84C" stroke-width="1.5"/>
      <text x="0" y="5" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="2" fill="#F5ECD7">JOIN US FOR THE FESTIVAL OF LIGHTS</text>
    </g>
  </g>
</svg>`

const svg3 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF8E1"/>
      <stop offset="35%" stop-color="#E8D5A3"/>
      <stop offset="100%" stop-color="#C9A84C"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="35%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="576" height="1024" fill="url(#vignette)"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="288" y="415" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="4" fill="#C9A84C" opacity="0.95">DIWALI VIBES • CELEBRATION • MEMORIES</text>
    <text x="288" y="475" font-size="30" font-weight="bold" fill="url(#goldGrad)" filter="url(#glow)">FRIDAY | OCT 23, 2026</text>
    <text x="288" y="512" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="3" fill="#FFFFFF" opacity="0.9">JAIPUR · RAJASTHAN</text>
    <line x1="200" y1="535" x2="376" y2="535" stroke="#C9A84C" stroke-width="1.5" opacity="0.6"/>
    <text x="288" y="555" font-family="Arial, sans-serif" font-size="10" font-weight="bold" letter-spacing="3" fill="#C9A84C" opacity="0.85">HOSTED BY</text>
    <text x="288" y="578" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="2.5" fill="#F5ECD7" opacity="0.95">ARPIT · VIPUL · JITU</text>
    <text x="288" y="600" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" letter-spacing="2.5" fill="#C9A84C" opacity="0.95">COMPLETE KHANDELWAL FAMILY</text>
  </g>
</svg>`

async function main() {
  const overlay1Path = path.join(__dirname, 'overlay_diwali_1.png')
  const overlay2Path = path.join(__dirname, 'overlay_diwali_2.png')
  const overlay3Path = path.join(__dirname, 'overlay_diwali_3.png')

  console.log('Generating PNG overlays with sharp...')
  await sharp(Buffer.from(svg1)).png().toFile(overlay1Path)
  await sharp(Buffer.from(svg2)).png().toFile(overlay2Path)
  await sharp(Buffer.from(svg3)).png().toFile(overlay3Path)
  console.log('Overlays saved successfully.')

  // Build FFmpeg command to overlay PNG 1 (0-5s), PNG 2 (5-10s), PNG 3 (10-15s) onto the video
  const filterComplex = `"[0:v][1:v]overlay=0:0:enable='between(t,0,5)'[v1]; [v1][2:v]overlay=0:0:enable='between(t,5,10)'[v2]; [v2][3:v]overlay=0:0:enable='between(t,10,15)'[vout]"`

  const cmd = `"${FFMPEG_PATH}" -y -i "${INPUT_VIDEO}" -i "${overlay1Path}" -i "${overlay2Path}" -i "${overlay3Path}" -filter_complex ${filterComplex} -map "[vout]" -map 0:a? -c:v libx264 -preset fast -crf 20 -c:a copy "${OUTPUT_VIDEO}"`

  console.log('Executing FFmpeg command to render Diwali Party Save The Date...')
  execSync(cmd, { stdio: 'inherit' })
  console.log('Diwali Video generated successfully at:', OUTPUT_VIDEO)
}

main().catch(console.error)
