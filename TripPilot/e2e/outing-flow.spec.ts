import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Outing full flow (GAP-R2-009)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('start session → quick-add → end → appears in outing history', async ({ page }) => {
    await page.goto('/outings/new');

    // Pick the first startable profile (cards show "Valor seguro")
    const profileCard = page
      .getByRole('button')
      .filter({ hasText: /valor seguro/i })
      .first();
    await expect(profileCard).toBeVisible();
    await profileCard.click();

    // Config screen → start
    const startButton = page.getByRole('button', { name: /iniciar saída/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Active session: tap the first quick-add value (€ button)
    const endButton = page.getByRole('button', { name: /encerrar/i }).first();
    await expect(endButton).toBeVisible();

    // Julio device test 2026-06-18: the active outing no longer embeds the photo
    // block (it moved to the review) — keep the live screen scroll-free.
    await expect(page.getByText(/toque para anexar uma foto/i)).toHaveCount(0);

    const quickButton = page
      .getByRole('button', { name: /€/ })
      .filter({ hasNotText: /outro/i })
      .first();
    await quickButton.click();

    // Enrichment stepper appears post-save (DEC-078) and is skippable
    await expect(page.getByText(/o que foi\?/i)).toBeVisible();

    // End the session → review screen
    await endButton.click();
    await expect(page.getByText(/revisão da saída/i)).toBeVisible();
    // Photos belong to the review now (DEC-206 + Julio 2026-06-18).
    await expect(page.getByText(/toque para anexar uma foto/i)).toBeVisible();
    await page.getByRole('button', { name: /confirmar e encerrar/i }).click();

    // Back on dashboard with success toast
    await page.waitForURL('/dashboard');

    // History tab shows the completed outing (DEC-079)
    await page.goto('/expenses?tab=outings');
    await expect(page.getByText(/1 (item|itens)/i).first()).toBeVisible();
  });
});
