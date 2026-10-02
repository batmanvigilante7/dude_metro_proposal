import sharp from 'sharp';

const src = 'C:/Users/heman/.gemini/antigravity-ide/brain/632d3401-7850-45a5-bedc-cf1576a5f31e/.user_uploaded/media_1790960987441.png';

const W = 1044;
const H = 1396; // Exactly matches 1.28 / 1.71 page aspect ratio

// Extract the complete card cleanly (x=29, y=152, w=522, h=698)
const cardRaw = await sharp(src)
  .extract({ left: 29, top: 152, width: 522, height: 698 })
  .resize(W, H, { kernel: 'lanczos3' })
  .toBuffer();

// ── Front Cover Overlay ──────────────────────────────────────────
// Left spine groove (at x ≈ 38..48px) + subtle hardcover bevel
const frontCoverSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Hardcover spine hinge groove on LEFT -->
    <linearGradient id="frontSpineHinge" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="2%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="3.2%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="3.8%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="4.5%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="6.5%" stop-color="#000000" stop-opacity="0.0"/>
    </linearGradient>
    <!-- Hardcover board edge border highlight -->
    <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="50%" stop-color="#000000" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  <!-- Spine hinge indentation -->
  <rect x="0" y="0" width="85" height="${H}" fill="url(#frontSpineHinge)"/>
  <!-- Bevel edge framing -->
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="4" fill="none" stroke="url(#edgeGlow)" stroke-width="3"/>
</svg>
`);

await sharp(cardRaw)
  .composite([{ input: frontCoverSvg, top: 0, left: 0 }])
  .webp({ quality: 92 })
  .toFile('public/images/book-cover.webp');

console.log('✓ Generated public/images/book-cover.webp');

// ── Back Cover Overlay ───────────────────────────────────────────
// Right spine groove (at x ≈ W - 48..W - 38px) + subtle hardcover bevel
const backCoverSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Hardcover spine hinge groove on RIGHT -->
    <linearGradient id="backSpineHinge" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="2%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="3.2%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="3.8%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="4.5%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="6.5%" stop-color="#000000" stop-opacity="0.0"/>
    </linearGradient>
    <!-- Hardcover board edge border highlight -->
    <linearGradient id="backEdgeGlow" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="50%" stop-color="#000000" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  <!-- Spine hinge indentation on right -->
  <rect x="${W - 85}" y="0" width="85" height="${H}" fill="url(#backSpineHinge)"/>
  <!-- Bevel edge framing -->
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="4" fill="none" stroke="url(#backEdgeGlow)" stroke-width="3"/>
</svg>
`);

await sharp(cardRaw)
  .composite([{ input: backCoverSvg, top: 0, left: 0 }])
  .webp({ quality: 92 })
  .toFile('public/images/book-back-cover.webp');

console.log('✓ Generated public/images/book-back-cover.webp');
