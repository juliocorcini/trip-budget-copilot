// Render the static /shared v2 mockup HTML to a crisp PNG (Pixel-5 width).
// Run from TripPilot/: node scripts/render-mockup.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../brain/documents/2026-06-26-settle-shots');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.join(dir, 'mockup-v2.html')).href);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(dir, 'mockup-v2.png'), fullPage: true });
await browser.close();
console.log('rendered mockup-v2.png');
