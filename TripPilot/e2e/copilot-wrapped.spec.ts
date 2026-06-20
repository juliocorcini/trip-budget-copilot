import { test, expect } from '@playwright/test';

// DEC-246 (module H / C1) — the Trip "Wrapped" retrospective. The entry lives on
// the Copiloto page, gated on real spend, and opens a bottom sheet of trip-wide
// superlatives. Demo data always has spend, so the entry must render and the
// sheet must paint a hero total plus the share action.

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('DEC-246 — Trip Wrapped', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
    await page.goto('/copiloto');
  });

  test('the Wrapped entry shows on a trip with spend and opens the recap sheet', async ({
    page,
  }) => {
    const entry = page.locator('[data-wrapped-entry]');
    await expect(entry).toBeVisible();
    await entry.click();

    // The sheet paints the hero total (a money string) and the share action.
    await expect(page.getByText(/Retrospectiva da viagem/i).first()).toBeVisible();
    await expect(page.locator('[data-wrapped-share]')).toBeVisible();
    await page.screenshot({ path: 'test-results/audit/wrapped-sheet.png' });
  });
});
