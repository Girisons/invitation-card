const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const opentype = require('opentype.js')

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
  const fontGreatVibes = getFont('GreatVibes.ttf')
  const fontCinzel = getFont('CinzelDeco.ttf')

  const width = 1200
  const height = 630

  // 1200x630 vector typography matching the new Diwali Save the Date script
  const pathTitle = textToSvgPath(fontGreatVibes, 'The Festive Soirée', 600, 285, 110)
  const pathDate = textToSvgPath(fontCinzel, 'FRIDAY • 23RD OCTOBER 2026', 600, 475, 24)

  const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF9E6"/>
        <stop offset="35%" stop-color="#F5D77F"/>
        <stop offset="70%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#AA7C11"/>
      </linearGradient>
      <radialGradient id="centerDim" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#050D1A" stop-opacity="0.94"/>
        <stop offset="58%" stop-color="#050D1A" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#050D1A" stop-opacity="0.25"/>
      </radialGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="#000000" flood-opacity="0.95"/>
        <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#FFD700" flood-opacity="0.5"/>
      </filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.95"/>
      </filter>
    </defs>

    <!-- Center dim to blend background seamlessly -->
    <rect width="${width}" height="${height}" fill="url(#centerDim)"/>

    <g text-anchor="middle">
      <!-- Top header -->
      <text x="600" y="170" font-family="Arial, sans-serif" font-size="16" font-weight="bold" letter-spacing="6" fill="#D4AF37" opacity="0.95" filter="url(#shadow)">KHANDELWAL FESTIVE</text>
      <line x1="460" y1="190" x2="740" y2="190" stroke="#D4AF37" stroke-width="1.2" opacity="0.5"/>

      <!-- The Festive Soirée Calligraphy -->
      <path d="${pathTitle}" fill="url(#goldGrad)" filter="url(#glow)"/>

      <!-- Translucent Play Button (Centered) -->
      <g transform="translate(600, 350)">
        <circle cx="0" cy="0" r="50" fill="#050D1A" fill-opacity="0.55" stroke="#FFF8E1" stroke-width="2.5" stroke-opacity="0.65"/>
        <polygon points="-11,-20 20,0 -11,20" fill="#FFF8E1" fill-opacity="0.95"/>
      </g>

      <!-- Date -->
      <path d="${pathDate}" fill="url(#goldGrad)" filter="url(#glow)"/>

      <!-- Khandelwal Diwali Bash Badge -->
      <g transform="translate(600, 535)">
        <rect x="-175" y="-18" width="350" height="36" rx="18" fill="#050D1A" fill-opacity="0.88" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.85"/>
        <text x="0" y="5" font-family="Arial, sans-serif" font-size="12" font-weight="bold" letter-spacing="3" fill="#FFF8E1">KHANDELWAL DIWALI BASH</text>
      </g>
    </g>
  </svg>`)

  const bg = await sharp('public/og.jpg')
    .resize(width, height, { fit: 'cover' })
    .blur(22)
    .modulate({ brightness: 0.65 })
    .toBuffer()

  await sharp(bg)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile('public/og-diwali.jpg')

  console.log('Generated public/og-diwali.jpg successfully! Size:', fs.statSync('public/og-diwali.jpg').size, 'bytes')
}

main().catch(console.error)
