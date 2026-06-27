// Render the 2nd round of /shared variants (D+E hybrids with clear balance).
// Run from TripPilot/: node scripts/render-variants2.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../brain/documents/2026-06-26-settle-shots');
const files = [
  'variant-f-people-balance',
  'variant-g-timeline-zones',
  'variant-h-people-activity',
  'variant-i-segment',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const f of files) {
  await page.goto(pathToFileURL(path.join(dir, `${f}.html`)).href);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(dir, `${f}.png`), fullPage: true });
  console.log(`rendered ${f}.png`);
}
await browser.close();
