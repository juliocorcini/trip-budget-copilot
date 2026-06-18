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
});
