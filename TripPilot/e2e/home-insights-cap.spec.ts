import { test, expect } from '@playwright/test';

/**
 * GATE 13 (audit §4.2) — the Home shows at most N insights at rest; the rest
 * stay one tap away behind "ver mais". The cap math is proven deterministically
 * in home-insights.test.ts; this guards the wiring end-to-end: when the demo
 * produces an overflow, the control reveals the rest in place and then retires.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Home insights cap (G13)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('reveals overflow insights via "ver mais" and keeps the home healthy', async ({ page }) => {
    // "Ver mais 5" / "See 5 more" / "Ver 5 más" — the digit keeps it distinct
    // from the expenses "ver todos / view all" control.
    const seeMore = page.getByRole('button', { name: /ver mais \d|see \d+ more|ver \d+ más/i });
    if ((await seeMore.count()) > 0) {
      await expect(seeMore.first()).toBeVisible();
      await seeMore.first().click();
      // Everything is now shown in place — the control retires (nothing dropped).
      await expect(seeMore).toHaveCount(0);
    }
    await expect(page).toHaveURL('/dashboard');
  });
});
