import { test, expect } from '@playwright/test';

/**
 * GATE 2 (canonical budget model) — "Adicionar trecho": creating a trecho creates
 * a Phase + dedicated fund + link in one guided door (name + dates + budget), with
 * no fund/pool/link jargon. The trip total is the SUM of the trechos (D14). The
 * demo trip's default new-trecho dates sit AFTER the last phase, so the happy path
 * never overlaps.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 2 — add a trecho with a dedicated budget', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the cross-phase overview shows the trip total = sum of trechos (D14)', async ({ page }) => {
    await page.goto('/viagem');
    await page.getByRole('button', { name: 'Todas as fases', exact: true }).click();

    await expect(page.getByText('Total da viagem')).toBeVisible();
    await expect(page.getByText('Soma dos trechos')).toBeVisible();
    // The total card exposes a base-currency value (never blank).
    await expect(page.getByText(/€\s?-?\d/).first()).toBeVisible();
  });

  test('creating a trecho adds its chip and a phase card (M2.1/M2.2)', async ({ page }) => {
    await page.goto('/viagem');
    await page.getByRole('button', { name: 'Todas as fases', exact: true }).click();

    // Open the guided door.
    await page.getByRole('button', { name: /adicionar trecho/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/um trecho é um pedaço da viagem/i)).toBeVisible();

    // Fill the 3 fields (name + budget; the default dates already sit after the
    // last trecho, so there is no overlap to resolve).
    await dialog.getByPlaceholder(/Burgos, Eurotrip/i).fill('Trecho E2E');
    await dialog.locator('input[type="number"]').fill('300');

    // Confirm (the sheet CTA, scoped to the dialog).
    await dialog.getByRole('button', { name: 'Adicionar trecho', exact: true }).click();

    // The new trecho shows up as a selector chip and a phase card on the hub.
    await expect(page.getByRole('button', { name: 'Trecho E2E', exact: true })).toBeVisible();
    await expect(page.getByText('Trecho E2E').first()).toBeVisible();
  });
});
