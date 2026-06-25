import { test, expect } from '@playwright/test';

/**
 * Field Fixes & Clarity #2 — Gate 5 (tools & capture).
 *  - E07 · DEC-327: the cost-benefit comparator is back in the FAB's visible
 *    smart-tools grid (it was buried in the collapsed "Mais ações").
 *  - E13 · DEC-333: the assistant ALWAYS offers the camera (it used to be hidden
 *    until cloud receipt OCR was opted-in); tapping it while OCR is still off
 *    shows the one-time consent first, then the camera-or-gallery chooser.
 *  (E10 — the comparator photo mapping, success→row / failure→review row with no
 *   silent drop — is locked by the comparator-rows unit guard; it needs the cloud
 *   OCR round-trip, so it is not deterministic in E2E.)
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Field Fixes #2 G5 — comparator in FAB + capture parity', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // E07 · DEC-327 — the comparator is a visible quick-action again, above "Dividir".
  test('the cost-benefit comparator shows in the FAB quick-actions grid', async ({ page }) => {
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    const comparator = page.getByRole('button', { name: /custo-benefício/i });
    await expect(comparator).toBeVisible();
    await comparator.click();
    await page.waitForURL('/comparator');
  });

  // E13 · DEC-333 — the assistant offers the camera even before cloud OCR is on,
  // and tapping it asks for the one-time consent (privacy stays opt-in, DEC-206).
  test('the assistant always offers the camera, with consent on first tap', async ({ page }) => {
    await page.goto('/quick-add');
    await page.getByRole('button', { name: /entrada por ia/i }).click();
    await expect(page.getByText(/entrada rápida/i)).toBeVisible();

    // Demo data ships cloud receipt OCR OFF — the camera must still be present
    // (it used to be hidden in this exact state — the E13 regression).
    const camera = page.getByRole('button', { name: /tirar foto da nota/i });
    await expect(camera).toBeVisible();

    await camera.click();
    await expect(page.getByText(/ler notas com ia/i)).toBeVisible();
  });
});
