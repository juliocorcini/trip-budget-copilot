// Regenerates every app icon from a single vector source of truth.
//
// DEC-255 — TripPilot mark = a location pin (the trip) whose head holds a
// two-tone compass needle (the pilot / navigation). Flat, text-free, legible
// down to 48px, in the brand palette. Run with `node scripts/generate-icons.mjs`
// after changing the geometry below. Outputs:
//   - public/icons/icon.svg                 (scalable source / SVG favicon)
//   - public/icons/icon-192.png             (PWA "any")
//   - public/icons/icon-512.png             (PWA "any")
//   - public/icons/icon-512-maskable.png    (PWA "maskable", full-bleed)
//   - public/icons/apple-touch-icon.png     (iOS home screen, full-bleed)
//   - android .../mipmap-*/ic_launcher.png          (legacy square)
//   - android .../mipmap-*/ic_launcher_round.png    (legacy round)
//   - android .../mipmap-*/ic_launcher_foreground.png (adaptive foreground)

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const NAVY = '#0F1419';
const TERRA = '#C75B39';
const CREAM = '#EDE8E0';

// The mark, authored in a 1024x1024 space and centered. The pin is the Material
// "place" teardrop, scaled so it spans ~62% of the canvas. The compass needle
// sits on a cream disc inside the pin head: north terracotta, south navy.
const MARK = `
  <path transform="translate(131,119) scale(31.75)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${TERRA}"/>
  <circle cx="512" cy="405" r="104" fill="${CREAM}"/>
  <path d="M512 315 L480 405 L544 405 Z" fill="${TERRA}"/>
  <path d="M512 495 L480 405 L544 405 Z" fill="${NAVY}"/>
`;

/** Build an SVG string. `bg`: rounded | solid | circle | none. `scale`: shrinks
 *  the mark about the canvas center (used to pad the adaptive foreground). */
function svg({ size, bg, scale = 1 }) {
  const mark =
    scale === 1
      ? MARK
      : `<g transform="translate(512,512) scale(${scale}) translate(-512,-512)">${MARK}</g>`;
  const bgEl =
    bg === 'rounded'
      ? `<rect width="1024" height="1024" rx="184" fill="${NAVY}"/>`
      : bg === 'solid'
        ? `<rect width="1024" height="1024" fill="${NAVY}"/>`
        : bg === 'circle'
          ? `<circle cx="512" cy="512" r="512" fill="${NAVY}"/>`
          : '';
  const dim = size ? `width="${size}" height="${size}" ` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dim}viewBox="0 0 1024 1024">${bgEl}${mark}</svg>`;
}

async function png(out, opts) {
  const abs = resolve(ROOT, out);
  await mkdir(dirname(abs), { recursive: true });
  await sharp(Buffer.from(svg(opts))).png().toFile(abs);
  console.log('  png', out);
}

const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const ADAPTIVE_PADDING = 0.82; // keep the mark inside the adaptive safe zone

async function main() {
  // Scalable source + SVG favicon (pretty-printed, no fixed pixel size).
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="184" fill="${NAVY}"/>
  <path transform="translate(131,119) scale(31.75)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${TERRA}"/>
  <circle cx="512" cy="405" r="104" fill="${CREAM}"/>
  <path d="M512 315 L480 405 L544 405 Z" fill="${TERRA}"/>
  <path d="M512 495 L480 405 L544 405 Z" fill="${NAVY}"/>
</svg>
`;
  await writeFile(resolve(ROOT, 'public/icons/icon.svg'), source);
  console.log('  svg public/icons/icon.svg');

  // PWA + web.
  await png('public/icons/icon-192.png', { size: 192, bg: 'rounded' });
  await png('public/icons/icon-512.png', { size: 512, bg: 'rounded' });
  await png('public/icons/icon-512-maskable.png', { size: 512, bg: 'solid' });
  await png('public/icons/apple-touch-icon.png', { size: 180, bg: 'solid' });

  // Android adaptive + legacy launchers, one PNG per density.
  for (const [density, size] of Object.entries(LEGACY)) {
    const dir = `android/app/src/main/res/mipmap-${density}`;
    await png(`${dir}/ic_launcher.png`, { size, bg: 'solid' });
    await png(`${dir}/ic_launcher_round.png`, { size, bg: 'circle' });
  }
  for (const [density, size] of Object.entries(FOREGROUND)) {
    const dir = `android/app/src/main/res/mipmap-${density}`;
    await png(`${dir}/ic_launcher_foreground.png`, {
      size,
      bg: 'none',
      scale: ADAPTIVE_PADDING,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
