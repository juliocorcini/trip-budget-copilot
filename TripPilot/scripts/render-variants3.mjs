// Render round-3 /shared variants. Pass slugs as args, e.g.:
//   node scripts/render-variants3.mjs variant-j-resolve-tabs variant-k-rich-people
// With no args, renders the full round-3 set (J..N).
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../brain/documents/2026-06-26-settle-shots');
const fallback = [
  'variant-j-resolve-tabs',
  'variant-k-rich-people',
  'variant-l-three-tabs',
  'variant-m-converged',
  'variant-n-scale',
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : fallback;

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
