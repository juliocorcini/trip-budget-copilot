/**
 * Generate PWA icon PNGs from SVG using sharp or a similar tool.
 * Run: node scripts/generate-icons.mjs
 * 
 * Requires: npm install -D sharp
 * If sharp is not available, the SVG itself can be used as the icon
 * in modern browsers that support SVG icons in manifests.
 */

import { readFileSync, writeFileSync } from 'fs';

const sizes = [192, 512];
const svgContent = readFileSync('public/icons/icon.svg', 'utf-8');

async function generate() {
  try {
    const sharp = await import('sharp');
    for (const size of sizes) {
      await sharp.default(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(`public/icons/icon-${size}.png`);
      console.log(`Generated icon-${size}.png`);
    }
  } catch {
    console.log('sharp not available — creating placeholder PNGs');
    for (const size of sizes) {
      const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F1419"/>
  <circle cx="256" cy="200" r="80" fill="none" stroke="#C75B39" stroke-width="16"/>
  <path d="M256 280 L256 380" stroke="#C75B39" stroke-width="16" stroke-linecap="round"/>
  <path d="M200 340 L256 380 L312 340" fill="none" stroke="#C75B39" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="256" y="460" text-anchor="middle" fill="#EDE8E0" font-family="sans-serif" font-size="48" font-weight="700" opacity="0.9">PILOT</text>
</svg>`;
      writeFileSync(`public/icons/icon-${size}.svg`, html);
      console.log(`Generated icon-${size}.svg (SVG fallback)`);
    }
  }
}

generate();
