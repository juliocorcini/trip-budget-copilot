import { test, expect } from '@playwright/test';

/**
 * GATE 3 + GATE 4 — the "Potes e planejados" section on /viagem lists every pot,
 * event and planned purchase (D9). Creation goes through the SINGLE planning door
 * ("Planejar um gasto", master §3.3): two plain questions (does it have a date? ·
 * where does the money come from?) route to an Event, a Pote or a Compra — no
 * fund/pool/scope/occurrence jargon.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 3/4 — "Potes e planejados" + single planning door', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the trip hub has a "Potes e planejados" section that lists existing pots (D9)', async ({
    page,
  }) => {
    await page.goto('/viagem');
    await expect(page.getByText('Potes e planejados')).toBeVisible();
    // The demo trip ships a global pot ("Compras pessoais") — it must be listed.
    await expect(page.getByText('Compras pessoais').first()).toBeVisible();
  });

  test('the single door creates a Pote (no date · à parte) and lists it (M4.1/M4.3)', async ({
    page,
  }) => {
    await page.goto('/viagem');

    await page.getByRole('button', { name: /planejar um gasto/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Q1 → no date (just an intention); Q2 → a separate amount just for this.
    await dialog.getByRole('button', { name: /não, é só uma intenção/i }).click();
    await dialog.getByRole('button', { name: /um valor à parte só pra isso/i }).click();
    // The summary makes the "stays apart" effect explicit (no jargon).
    await expect(dialog.getByText(/à parte/i).first()).toBeVisible();

    await dialog.getByPlaceholder(/Roupas, presentes/i).fill('Pote E2E');
    await dialog.locator('input[type="number"]').first().fill('80');
    await dialog.getByRole('button', { name: 'Planejar', exact: true }).click();

    await expect(page.getByText('Pote E2E').first()).toBeVisible();
  });

  test('the single door creates an Event (with a date) and lists it (M4.4)', async ({ page }) => {
    await page.goto('/viagem');

    await page.getByRole('button', { name: /planejar um gasto/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Q1 → has a date (an event); Q2 → a separate amount just for this.
    await dialog.getByRole('button', { name: /sim, tem data/i }).click();
    await dialog.getByRole('button', { name: /um valor à parte só pra isso/i }).click();

    await dialog.getByPlaceholder(/Tomorrowland/i).fill('Show E2E');
    await dialog.locator('input[type="number"]').first().fill('120');
    await dialog.getByRole('button', { name: 'Planejar', exact: true }).click();

    await expect(page.getByText('Show E2E').first()).toBeVisible();
  });
});
