import { test, expect, type Page } from '@playwright/test';

/**
 * DEC-208 — the receipt split must be an EXPLICIT participant picker, never
 * auto-"everyone". This proves the default state: opening the review with a
 * fresh item shows the "Dividir com quem?" picker with the "Todos" opt-in
 * button (which only renders when NOBODY is selected). The old bug pre-filled
 * the whole roster; the fix starts personal and makes the traveler choose.
 */

const SHOTS = '.ux-shots/share';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Receipt split participant picker (DEC-208)', () => {
  test('manual review defaults to personal, with explicit "who splits" picker', async ({ page }) => {
    await loadDemo(page);
    await page.goto('/receipt/scan');

    // Capture screen → manual entry (no OCR needed).
    await page.getByRole('button', { name: 'Adicionar itens manualmente' }).click();

    // The explicit picker is present (demo has 2 participants: Você + Ana).
    await expect(page.getByText('Dividir com quem?')).toBeVisible({ timeout: 10_000 });

    // "Todos" renders ONLY when nobody is selected → proof the default is
    // personal, not auto-everyone (the DEC-208 fix).
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();

    // Both participants are offered as choosable chips.
    await expect(page.getByRole('button', { name: 'Você' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ana' })).toBeVisible();

    await page.screenshot({ path: `${SHOTS}/06-receipt-split-picker.png`, fullPage: true });
  });
});
