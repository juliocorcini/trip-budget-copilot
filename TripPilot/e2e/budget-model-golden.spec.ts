import { test, expect } from '@playwright/test';

/**
 * GATE 6 (M6.4) — GOLDEN PATH for the canonical budget model v2 (DEC-219→225).
 *
 * One end-to-end journey across the 4 visible concepts (Trecho · Pote · Evento ·
 * Compra planejada), PLUS an anti-regression sweep (DEC-219/D16, §8): rhythm,
 * peak days, activity profiles, funds and wallets must all stay reachable. The
 * reform simplified the vocabulary, never the capability.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 6 — budget model v2 golden path', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('canonical journey: dashboard → trechos → single-door event w/ new pote → advanced view', async ({
    page,
  }) => {
    // 1. The dashboard hero shows the ACTIVE trecho's money (DEC-219/D3).
    await expect(page.getByText(/€\s?-?\d/).first()).toBeVisible();

    // 2. The Viagem hub lists the trechos and the "Potes e planejados" section (D9).
    await page.goto('/viagem');
    await expect(page.getByText('Burgos antes da eurotrip').first()).toBeVisible();
    await expect(page.getByText('Potes e planejados')).toBeVisible();

    // 3. The SINGLE planning door creates an Event funded by a NEW pote — the
    //    canonical Tomorrowland shape (a thing on a date, money set apart) (DEC-221).
    await page.getByRole('button', { name: /planejar um gasto/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /sim, tem data/i }).click();
    await dialog.getByRole('button', { name: /um valor à parte só pra isso/i }).click();
    await dialog.getByPlaceholder(/Tomorrowland/i).fill('Golden Fest');
    await dialog.locator('input[type="number"]').first().fill('200');
    await dialog.getByRole('button', { name: 'Planejar', exact: true }).click();
    await expect(page.getByText('Golden Fest').first()).toBeVisible();

    // 4. Settings → "Visão avançada da viagem" exposes the raw backend (DEC-219/D17).
    await page.goto('/settings/c/money');
    const advanced = page.getByText('Visão avançada da viagem');
    await advanced.scrollIntoViewIfNeeded();
    await expect(advanced).toBeVisible();
    await expect(page.getByText(/Fundos \(/)).toBeVisible();
    await expect(page.getByText(/Carteiras \(/)).toBeVisible();
  });

  test('anti-regression (D16): rhythm, peak, activities, funds and wallets stay reachable', async ({
    page,
  }) => {
    // Phase rhythm + peak days (DEC-075) live on the trecho editor.
    await page.goto('/trip/edit');
    await expect(page.getByText('Ritmo da fase').first()).toBeVisible();
    await expect(page.getByText('Dias de pico').first()).toBeVisible();

    // Activity profiles (DEC-074).
    await page.goto('/profiles');
    await expect(page.getByText('Perfis de atividade')).toBeVisible();

    // The raw funds + wallets editors (the advanced view's "edit" targets).
    await page.goto('/funds');
    await expect(page.getByRole('heading', { name: 'Fundos' })).toBeVisible();
    await page.goto('/wallets');
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible();
  });
});
