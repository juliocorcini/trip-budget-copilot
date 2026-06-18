import { test, expect } from '@playwright/test';

/**
 * GATE 3 (Unified Pots) — a "Pote" is money set apart with a purpose. The
 * "Potes e planejados" section on /viagem lists every pot (D9); creating one
 * goes through a guided door (name + amount, optional date/goal) with no
 * fund/pool/scope jargon.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 3 — pots ("Potes e planejados")', () => {
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

  test('creating a pot adds it to the section (M3.2/M3.4)', async ({ page }) => {
    await page.goto('/viagem');

    await page.getByRole('button', { name: /novo pote/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The "why" microcopy frames a pot as money set apart (no jargon).
    await expect(dialog.getByText(/dinheiro à parte/i)).toBeVisible();

    await dialog.getByPlaceholder(/Compras, Tomorrowland/i).fill('Pote E2E');
    await dialog.locator('input[type="number"]').first().fill('80');

    await dialog.getByRole('button', { name: 'Criar pote', exact: true }).click();

    // The new pot shows up in the section.
    await expect(page.getByText('Pote E2E').first()).toBeVisible();
  });
});
