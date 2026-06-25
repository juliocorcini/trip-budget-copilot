import { test, expect } from '@playwright/test';

/**
 * Discovery & Clarity — Gate 1.
 *  - D09 · DEC-318: an open FAB never survives a context switch (tab tap / outside tap).
 *  - D06 · DEC-317: the Amigo Sincero is voice-only — its factual extras moved to
 *    the insights carousel, so the friend's card never renders a factual-extra
 *    carousel (its slide tablist only exists for 2+ real slides).
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Discovery & Clarity G1 — FAB + Amigo Sincero', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // D09 · DEC-318
  test('an open FAB closes when a bottom-nav tab is tapped', async ({ page }) => {
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    // The FAB menu overlay is the only [data-no-tab-swipe] surface on the home.
    await expect(page.locator('[data-no-tab-swipe]')).toBeVisible();

    await page.locator('nav').getByText(/gastos|expenses/i).click();
    await page.waitForURL('/expenses');

    // It must never stay mounted over the new screen (the reported "bug").
    await expect(page.locator('[data-no-tab-swipe]')).toHaveCount(0);
  });

  // D09 · DEC-318 — outside tap (scrim) closes it too, without navigating.
  test('an open FAB closes on an outside (scrim) tap', async ({ page }) => {
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    await expect(page.locator('[data-no-tab-swipe]')).toBeVisible();

    // Tap the scrim far from the sheet (top-left corner).
    await page.mouse.click(8, 8);

    await expect(page.locator('[data-no-tab-swipe]')).toHaveCount(0);
    await expect(page).toHaveURL('/dashboard');
  });

  // D06 · DEC-317 — no factual carousel inside the Amigo Sincero (home + copiloto).
  test('Amigo Sincero never carousels factual extras (voice only)', async ({ page }) => {
    // The slide tablist is labelled with the card title and only renders with 2+
    // REAL slides (verdict + extras). Voice-only ⇒ at most the verdict ⇒ no tablist.
    await expect(page.getByRole('tablist', { name: /amigo/i })).toHaveCount(0);

    await page.locator('nav').getByText(/copiloto|copilot/i).click();
    await page.waitForURL('/copiloto');
    await expect(page.getByRole('tablist', { name: /amigo/i })).toHaveCount(0);
  });
});
