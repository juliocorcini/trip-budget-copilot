// One-off capture: screenshots of the "Acerto de contas" (/shared) page for the
// visual council (wave 2026-06-26, G9). Uses the already-running dev server.
// Run from TripPilot/: node scripts/capture-settle.mjs
import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../brain/documents/2026-06-26-settle-shots');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const shot = async (page, name) =>
  page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 5'] });
const page = await context.newPage();

// 1) Seed demo data (same path the E2E specs use).
await page.goto(`${BASE}/`);
await page.getByRole('button', { name: /demo|demonstração/i }).click();
await page.waitForURL('**/dashboard', { timeout: 15000 });

// 2) Open the settle-up page.
await page.goto(`${BASE}/shared`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

// 3) Full-page overview (one tall image).
await shot(page, 'shared-full.png');

// 4) Legible per-screen segments (what actually fits on a phone per scroll).
const vh = page.viewportSize().height;
const totalHeight = await page.evaluate(() => document.body.scrollHeight);
let idx = 0;
for (let y = 0; y < totalHeight; y += Math.round(vh * 0.9)) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(450);
  await shot(page, `shared-seg-${String(idx).padStart(2, '0')}.png`);
  idx += 1;
}

// 5) Expand the in-page accordions/sections so the council sees hidden content too.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const expanders = page.getByRole('button', {
  name: /pagamentos|quem paga|divis|pessoas|amigos|grupo|hist[oó]rico|extrato|conectad/i,
});
const count = await expanders.count();
for (let i = 0; i < count; i++) {
  try {
    const btn = expanders.nth(i);
    if (await btn.isVisible()) await btn.click({ timeout: 1500 });
  } catch {
    /* ignore non-toggles */
  }
}
await page.waitForTimeout(800);
await shot(page, 'shared-expanded-full.png');

console.log(`Captured ${idx + 2} screenshots to ${OUT}`);
await browser.close();
