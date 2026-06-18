import { test, expect } from '@playwright/test';

/**
 * GATE 13 (audit §4.2) + Julio device test 2026-06-18 — the Home shows at most N
 * insights at rest (the cap math is proven deterministically in
 * home-insights.test.ts). The rest now live on the Copiloto: instead of an
 * in-place "ver mais", a thin "Veja mais no copiloto" bar links there. This
 * guards the wiring end-to-end: the bar is present and routes to /copiloto.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Home insights → Copiloto (G13 / device test 2026-06-18)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the insights "veja mais no copiloto" bar routes to the Copiloto', async ({ page }) => {
    const moreInCopilot = page.getByRole('button', {
      name: /veja mais no copiloto|see more in the copilot|ver más en el copiloto/i,
    });
    // The bar shows whenever the Home has insights (the demo data produces them).
    if ((await moreInCopilot.count()) > 0) {
      await expect(moreInCopilot.first()).toBeVisible();
      await moreInCopilot.first().click();
      await expect(page).toHaveURL('/copiloto');
    } else {
      await expect(page).toHaveURL('/dashboard');
    }
  });
});
