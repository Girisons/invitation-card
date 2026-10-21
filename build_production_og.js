const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');

const bgPath = path.join(__dirname, 'scratch_bg.jpg');

function loadFont(fontPath) {
  const buf = fs.readFileSync(fontPath);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const fontCinzel = loadFont(path.join(__dirname, 'Cinzel-Real.ttf'));
const fontGreatVibes = loadFont(path.join(__dirname, 'GreatVibes.ttf'));

function pathToSvgData(commands) {
  let d = '';
  for (const cmd of commands) {
    if (cmd.type === 'M') d += `M${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
    else if (cmd.type === 'L') d += `L${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
    else if (cmd.type === 'C') d += `C${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} ${cmd.x2.toFixed(2)} ${cmd.y2.toFixed(2)} ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
    else if (cmd.type === 'Q') d += `Q${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
    else if (cmd.type === 'Z') d += 'Z';
  }
  return d;
}

function textToSvgPath(font, text, centerX, centerY, fontSize, letterSpacing = 0) {
  const scale = (1 / font.unitsPerEm) * fontSize;
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    totalWidth += (glyph.advanceWidth || 0) * scale + (i < text.length - 1 ? letterSpacing : 0);
  }
  let x = centerX - totalWidth / 2;
  const allCmds = [];
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    const glyphPath = glyph.getPath(x, centerY, fontSize);
    allCmds.push(...glyphPath.commands);
    x += (glyph.advanceWidth || 0) * scale + letterSpacing;
  }
  return pathToSvgData(allCmds);
}

async function renderCard({
  outputPath,
  scriptTitle = 'The Night Awaits',
  scriptSize = 80,
  bottomLine1 = "ARPIT'S 40TH & DIWALI",
  bottomLine2 = "23RD OCT · JAIPUR"
}) {
  const width = 1200;
  const height = 630;

  // Header: INVITATION in Cinzel Bold
  const pTopTag = textToSvgPath(fontCinzel, 'INVITATION', 600, 95, 25, 7);

  // Hero Title: The Night Awaits in Great Vibes Script
  const pScript = textToSvgPath(fontGreatVibes, scriptTitle, 600, 235, scriptSize, 0);

  // Subtitles in Cinzel Bold
  const pSub1 = textToSvgPath(fontCinzel, bottomLine1, 600, 500, 34, 3);
  const pSub2 = textToSvgPath(fontCinzel, bottomLine2, 600, 558, 28, 4.5);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Rich Royal Radial Vignette for Depth & Contrast -->
        <radialGradient id="vig" cx="50%" cy="50%" r="56%">
          <stop offset="0%" stop-color="#040A14" stop-opacity="0.45"/>
          <stop offset="48%" stop-color="#040A14" stop-opacity="0.75"/>
          <stop offset="85%" stop-color="#040A14" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#02050B" stop-opacity="0.98"/>
        </radialGradient>

        <!-- High-End Metallic 3D Gold Gradient for Script Title -->
        <linearGradient id="goldHero" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="25%" stop-color="#FFF5CC"/>
          <stop offset="65%" stop-color="#F2C659"/>
          <stop offset="100%" stop-color="#C2871A"/>
        </linearGradient>

        <!-- Bright Gold Gradient for Subtitles -->
        <linearGradient id="goldSub" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="45%" stop-color="#FFECA8"/>
          <stop offset="100%" stop-color="#DFA836"/>
        </linearGradient>

        <!-- Shimmering Gold Illumination Glow -->
        <filter id="glowHero" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.95"/>
          <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#D4AF37" flood-opacity="0.45"/>
        </filter>

        <!-- Drop Shadow for Subtitles & Tags -->
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.95"/>
        </filter>
      </defs>

      <!-- Background Vignette -->
      <rect width="${width}" height="${height}" fill="url(#vig)"/>

      <!-- Top Tag: INVITATION -->
      <path d="${pTopTag}" fill="#FCE18F" filter="url(#textShadow)"/>

      <!-- Hero Title: The Night Awaits -->
      <path d="${pScript}" fill="url(#goldHero)" filter="url(#glowHero)"/>

      <!-- Play Button (Classic Translucent Circle) -->
      <g transform="translate(600, 376)" filter="url(#textShadow)">
        <circle cx="0" cy="0" r="62" fill="#070E1A" fill-opacity="0.82" stroke="#FCE18F" stroke-opacity="0.85" stroke-width="3.5"/>
        <polygon points="-15,-25 28,0 -15,25" fill="#FFFFFF"/>
      </g>

      <!-- Bottom Line 1: ARPIT'S 40TH & DIWALI / DIWALI CELEBRATION -->
      <path d="${pSub1}" fill="url(#goldSub)" filter="url(#textShadow)"/>

      <!-- Bottom Line 2: 23RD OCT · JAIPUR -->
      <path d="${pSub2}" fill="#FFFDF5" filter="url(#textShadow)"/>
    </svg>
  `;

  await sharp(bgPath)
    .resize(width, height, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  // Also create a square thumbnail version (630x630)
  const sqPath = outputPath.replace('.jpg', '-sq.jpg');
  await sharp(outputPath)
    .extract({ left: 285, top: 0, width: 630, height: 630 })
    .jpeg({ quality: 95 })
    .toFile(sqPath);

  console.log('Saved production OG:', outputPath, 'and', sqPath);
}

async function run() {
  // 1. Arpit's 40th & Diwali Celebration Main Invite
  await renderCard({
    outputPath: 'public/og-main.jpg',
    scriptTitle: 'The Night Awaits',
    bottomLine1: "ARPIT'S 40TH & DIWALI",
    bottomLine2: "23RD OCT · JAIPUR"
  });

  // 2. Diwali Celebration Main Invite
  await renderCard({
    outputPath: 'public/og-diwali-main.jpg',
    scriptTitle: 'The Festive Soirée',
    scriptSize: 76,
    bottomLine1: "DIWALI CELEBRATION",
    bottomLine2: "23RD OCT · JAIPUR"
  });

  console.log('All production OG cards built successfully with Option 2: Gold Calligraphy!');
}

run().catch(console.error);
