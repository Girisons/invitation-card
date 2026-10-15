const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const opentype = require('opentype.js')
const { execSync } = require('child_process')

const FFMPEG_PATH = "C:\\Users\\Arpit Khandelwal\\AppData\\Local\\Cypress\\Cache\\15.18.1\\Cypress\\resources\\app\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe"
const INPUT_VIDEO = fs.existsSync(path.join(__dirname, 'public', 'videos', 'Save the date vedio.mp4'))
  ? path.join(__dirname, 'public', 'videos', 'Save the date vedio.mp4')
  : path.join(__dirname, 'public', 'videos', 'main-invite.mp4')
const OUTPUT_VIDEO = path.join(__dirname, 'public', 'videos', 'save-the-date-diwali.mp4')

function getFont(filename) {
  const localPath = path.join(__dirname, filename)
  const buf = fs.readFileSync(localPath)
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

function pathToSvgData(commands) {
  let d = ''
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      d += `M${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`
    } else if (cmd.type === 'L') {
      d += `L${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`
    } else if (cmd.type === 'C') {
      d += `C${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} ${cmd.x2.toFixed(2)} ${cmd.y2.toFixed(2)} ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`
    } else if (cmd.type === 'Q') {
      d += `Q${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`
    } else if (cmd.type === 'Z') {
      d += 'Z'
    }
  }
  return d
}

function textToSvgPath(font, text, centerX, centerY, fontSize) {
  const scale = (1 / font.unitsPerEm) * fontSize
  let totalWidth = 0
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    totalWidth += (glyph.advanceWidth || 0) * scale
  }
  let x = centerX - totalWidth / 2
  const allCommands = []
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    const glyphPath = glyph.getPath(x, centerY, fontSize)
    allCommands.push(...glyphPath.commands)
    x += (glyph.advanceWidth || 0) * scale
  }
  return pathToSvgData(allCommands)
}

async function main() {
  console.log('Loading luxury Google Fonts (Great Vibes & Cinzel Decorative)...')
  const fontGreatVibes = getFont('GreatVibes.ttf')
  const fontCinzel = getFont('CinzelDeco.ttf')

  const commonDefs = `
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF9E6"/>
        <stop offset="35%" stop-color="#F5D77F"/>
        <stop offset="70%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#AA7C11"/>
      </linearGradient>
      <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.65"/>
        <stop offset="30%" stop-color="#000000" stop-opacity="0.45"/>
        <stop offset="70%" stop-color="#000000" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.88"/>
      </linearGradient>
      <radialGradient id="centerDark" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.7"/>
        <stop offset="70%" stop-color="#000000" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000000" flood-opacity="0.95"/>
        <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#FFD700" flood-opacity="0.45"/>
      </filter>
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.9"/>
      </filter>
    </defs>
  `

  // BEAT 1 (0:00 – 0:04): KHANDELWAL FESTIVE / The Festive Soirée / KHANDELWAL DIWALI BASH
  const pathSoiree1 = textToSvgPath(fontGreatVibes, 'The Festive Soirée', 288, 515, 72)
  const svg1 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${commonDefs}
    <rect width="576" height="1024" fill="url(#vignette)"/>
    <ellipse cx="288" cy="510" rx="250" ry="130" fill="url(#centerDark)"/>
    <g text-anchor="middle">
      <text x="288" y="435" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="5" fill="#D4AF37" opacity="0.95" filter="url(#softGlow)">KHANDELWAL FESTIVE</text>
      <line x1="210" y1="448" x2="366" y2="448" stroke="#D4AF37" stroke-width="1" opacity="0.5"/>

      <path d="${pathSoiree1}" fill="url(#goldGrad)" filter="url(#glow)"/>

      <line x1="200" y1="548" x2="376" y2="548" stroke="#D4AF37" stroke-width="1" opacity="0.5"/>
      <text x="288" y="578" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="4" fill="#FBF6E9" opacity="0.95" filter="url(#softGlow)">KHANDELWAL DIWALI BASH</text>
    </g>
  </svg>`

  // BEAT 2 (0:05 – 0:09): Vignette & ambient center backdrop only so live {guest.name} from database overlays cleanly in VideoScreen.tsx
  const svg2 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${commonDefs}
    <rect width="576" height="1024" fill="url(#vignette)"/>
    <ellipse cx="288" cy="510" rx="250" ry="140" fill="url(#centerDark)"/>
  </svg>`

  // BEAT 3 (0:10 – 0:14): DRINKS · DANCE · CELEBRATION / FRIDAY | OCT 23, 2026 / JAIPUR · RAJASTHAN
  const pathDate3 = textToSvgPath(fontCinzel, 'FRIDAY | OCT 23, 2026', 288, 490, 26)
  const svg3 = `<svg width="576" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${commonDefs}
    <rect width="576" height="1024" fill="url(#vignette)"/>
    <ellipse cx="288" cy="500" rx="250" ry="140" fill="url(#centerDark)"/>
    <g text-anchor="middle">
      <text x="288" y="430" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" letter-spacing="4" fill="#D4AF37" opacity="0.95" filter="url(#softGlow)">DRINKS  ·  DANCE  ·  CELEBRATION</text>
      
      <path d="${pathDate3}" fill="url(#goldGrad)" filter="url(#glow)"/>
      
      <text x="288" y="535" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="3.5" fill="#FFFFFF" opacity="0.95" filter="url(#softGlow)">JAIPUR  ·  RAJASTHAN</text>
      <line x1="190" y1="558" x2="386" y2="558" stroke="#D4AF37" stroke-width="1.2" opacity="0.6"/>
    </g>
  </svg>`

  const overlay1Path = path.join(__dirname, 'overlay_diwali_1.png')
  const overlay2Path = path.join(__dirname, 'overlay_diwali_2.png')
  const overlay3Path = path.join(__dirname, 'overlay_diwali_3.png')

  console.log('Rendering high-resolution vector PNG overlays...')
  await sharp(Buffer.from(svg1)).png().toFile(overlay1Path)
  await sharp(Buffer.from(svg2)).png().toFile(overlay2Path)
  await sharp(Buffer.from(svg3)).png().toFile(overlay3Path)
  console.log('Overlays saved successfully.')

  // Build FFmpeg command to overlay PNG 1 (0-5s), PNG 2 (5-10s), PNG 3 (10-15s) with smooth alpha transitions
  const filterComplex = `"[1:v]format=yuva420p,fade=t=in:st=0.2:d=0.6:alpha=1,fade=t=out:st=4.4:d=0.5:alpha=1[ov1]; [2:v]format=yuva420p,fade=t=in:st=5.0:d=0.4:alpha=1,fade=t=out:st=9.5:d=0.4:alpha=1[ov2]; [3:v]format=yuva420p,fade=t=in:st=10.2:d=0.6:alpha=1,fade=t=out:st=14.4:d=0.5:alpha=1[ov3]; [0:v][ov1]overlay=0:0:enable='between(t,0,5)'[v1]; [v1][ov2]overlay=0:0:enable='between(t,5,10)'[v2]; [v2][ov3]overlay=0:0:enable='between(t,10,15)'[vout]"`

  const cmd = `"${FFMPEG_PATH}" -y -i "${INPUT_VIDEO}" -loop 1 -i "${overlay1Path}" -loop 1 -i "${overlay2Path}" -loop 1 -i "${overlay3Path}" -filter_complex ${filterComplex} -map "[vout]" -map 0:a? -c:v libx264 -preset fast -crf 20 -c:a copy -shortest "${OUTPUT_VIDEO}"`

  console.log('Executing FFmpeg command to render Diwali Party Save The Date...')
  execSync(cmd, { stdio: 'inherit' })
  console.log('Diwali Video successfully rendered at:', OUTPUT_VIDEO)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
