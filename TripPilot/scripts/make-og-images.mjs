/**
 * DEC-445 (G5) — branded Open Graph card images (1200×630) for link previews.
 *
 * Generates `public/og/{default,group,split,statement}.png` from an SVG
 * composition reusing the app icon mark + brand palette (surface #0F1419,
 * accent #C75B39, cream #EDE8E0). Run once and commit the PNGs (they are
 * static assets, not build artifacts):
 *
 *   node scripts/make-og-images.mjs
 *
 * Text uses DejaVu Sans (present on the build machine); the cards are the
 * global fallback art — per-share data is injected as og:title/description
 * by the Pages Function, and a share photo (imgId) replaces og:image.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'og');
mkdirSync(outDir, { recursive: true });

const CARDS = {
  default: 'Orçamento de viagem no seu bolso',
  group: 'Divisão em grupo — veja sua parte',
  split: 'Divisão ao vivo — a conta na mesa',
  statement: 'Acerto de contas compartilhado',
};

// The app icon (public/icons/icon.svg) internals, scaled 1024 → 300.
const logo = `
  <g transform="translate(100,165) scale(0.29296875)">
    <rect width="1024" height="1024" rx="184" fill="#161C23"/>
    <path transform="translate(131,119) scale(31.75)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#C75B39"/>
    <circle cx="512" cy="405" r="104" fill="#EDE8E0"/>
    <path d="M512 315 L480 405 L544 405 Z" fill="#C75B39"/>
    <path d="M512 495 L480 405 L544 405 Z" fill="#0F1419"/>
  </g>`;

function cardSvg(tagline) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0F1419"/>
  <path d="M1200 630 L1200 380 Q1050 470 940 630 Z" fill="#161C23"/>
  ${logo}
  <text x="470" y="330" font-family="DejaVu Sans" font-size="94" font-weight="700" fill="#EDE8E0">TripPilot</text>
  <rect x="476" y="362" width="120" height="10" rx="5" fill="#C75B39"/>
  <text x="470" y="444" font-family="DejaVu Sans" font-size="35" fill="#A8B0B9">${tagline}</text>
</svg>`;
}

for (const [name, tagline] of Object.entries(CARDS)) {
  const png = await sharp(Buffer.from(cardSvg(tagline))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(outDir, `${name}.png`), png);
  console.log(`[og] ${name}.png ${(png.length / 1024).toFixed(0)} KB`);
}
