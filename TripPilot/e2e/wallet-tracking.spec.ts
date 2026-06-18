import { test, expect } from '@playwright/test';

/**
 * GATE 5 (D10) — progressive wallet tracking. The "de onde saiu o dinheiro?"
 * wallet question is INVISIBLE for a single-source traveler and lights up with
 * 2+ wallets or a Wise import; a manual override in Settings forces it on/off.
 * The demo trip ships two wallets, so tracking is automatically ON — flipping
 * the Settings control to "never ask" must hide the wallet picker on Quick Add.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 5 — progressive wallet tracking (D10)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('AUTO: the demo trip (2 wallets) shows the wallet question on Quick Add', async ({
    page,
  }) => {
    await page.goto('/quick-add');
    await expect(page.getByText('Carteira não informada')).toBeVisible();
  });

  test('manual OFF hides the wallet question; back to AUTO shows it again', async ({ page }) => {
    // Force tracking OFF from Settings → the everyday spend stops asking.
    await page.goto('/settings/c/device');
    await page.getByRole('button', { name: 'Nunca perguntar' }).click();
    await expect(page.getByText(/Agora: desligado/i)).toBeVisible();

    await page.goto('/quick-add');
    await expect(page.getByText('Carteira não informada')).toHaveCount(0);

    // Back to automatic → with 2 wallets the question returns.
    await page.goto('/settings/c/device');
    await page.getByRole('button', { name: 'Automático' }).click();
    await expect(page.getByText(/Agora: ligado/i)).toBeVisible();

    await page.goto('/quick-add');
    await expect(page.getByText('Carteira não informada')).toBeVisible();
  });
});
