import { test, expect, type Page } from '@playwright/test';

/**
 * GATE 11 (audit §4.15 / G9) — splitting used to be explained (or not) with
 * different wording on each of the four split surfaces. It is now described by
 * ONE shared component ("Como funciona a divisão"), shown with identical copy
 * everywhere it appears. Anti-regression: it is collapsed by default and changes
 * no split behaviour.
 */
async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 11 — single split explainer', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('QuickAdd shows the explainer collapsed and expands the how-it-works steps', async ({
    page,
  }) => {
    await page.goto('/quick-add');
    const explainer = page.getByRole('button', { name: /Como funciona a divisão/i });
    await expect(explainer).toBeVisible();
    // Collapsed by default → the step copy is not in the DOM yet.
    await expect(page.getByText(/o app sugere quem paga quem/i)).toHaveCount(0);
    await explainer.click();
    await expect(page.getByText(/o app sugere quem paga quem/i)).toBeVisible();
  });

  test('the Shared screen shows the same explainer (consistent wording)', async ({ page }) => {
    await page.goto('/shared');
    await expect(
      page.getByRole('button', { name: /Como funciona a divisão/i }),
    ).toBeVisible();
  });

  // 0.99.11 (OD-3 / DEC-242) — the 4th and final split surface: classifying a
  // Wise transfer that you split with a person now shows the identical explainer.
  test('the Wise importer transfer sheet shows the same explainer (4th surface)', async ({
    page,
  }) => {
    await page.goto('/import/wise');
    // A minimal Wise statement: one outgoing TRANSFER to a named person → a
    // person-to-person move the importer asks you to classify/split.
    const csv = [
      'TransferWise ID,Date,Amount,Currency,Description,Payee Name,Transaction Type,Transaction Details Type',
      'TRANSFER-E2E-1,15-07-2026,-50.00,EUR,Sent money to Ana,Ana,DEBIT,TRANSFER',
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'wise-e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    // The transfer lands in the "transfers to people" section; open its sheet.
    await page.getByRole('button', { name: /Ana/ }).first().click();
    const explainer = page.getByRole('button', { name: /Como funciona a divisão/i });
    await expect(explainer).toBeVisible();
    await page.screenshot({ path: 'test-results/audit/wise-split-explainer.png' });
    // Same collapsed-by-default behaviour as the other three surfaces.
    await expect(page.getByText(/o app sugere quem paga quem/i)).toHaveCount(0);
    await explainer.click();
    await expect(page.getByText(/o app sugere quem paga quem/i)).toBeVisible();
  });
});
