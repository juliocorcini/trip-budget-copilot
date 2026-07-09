/**
 * Generates the OG card image (1200x630) from the HTML template using Playwright.
 * Usage: node scripts/generate-og-card.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(__dirname, 'og-card-template.html');
const OUTPUT = resolve(__dirname, '..', 'public', 'og', 'og-card.png');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`file://${TEMPLATE}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUTPUT, type: 'png' });
  await browser.close();
  console.log(`OG card saved to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
