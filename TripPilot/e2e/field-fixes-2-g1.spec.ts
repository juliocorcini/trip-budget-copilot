import { test, expect } from '@playwright/test';

/**
 * Field Fixes & Clarity #2 — Gate 1.
 *  - E03 · DEC-323: the AI quick-entry button on Quick Add (a route OUTSIDE the
 *    AppShell) now opens the assistant. Before, AssistantSheet was mounted inside
 *    AppShell only, so openAssistant() on /quick-add published to a dead bus and
 *    the purple button did nothing.
 *  - E04 · DEC-324: the statement-import entry on the expenses screen carries a
 *    visible text label (like the "Escanear" chip), not an icon alone.
 *  (E11 scrollbar lock is enforced by the unit CSS-hygiene test, not E2E.)
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Field Fixes #2 G1 — global assistant + labelled import', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // E03 · DEC-323 — the AI button works on a route outside the AppShell.
  test('the AI button opens the assistant from Quick Add (outside the shell)', async ({ page }) => {
    await page.goto('/quick-add');
    // The manual form's AI shortcut (aria-label "Entrada por IA").
    await page.getByRole('button', { name: /entrada por ia/i }).click();
    // The assistant overlay must now appear (its title is "Entrada rápida").
    await expect(page.getByText(/entrada rápida/i)).toBeVisible();
  });

  // E04 · DEC-324 — the import entry shows its label.
  test('the statement-import entry on the expenses screen shows a text label', async ({ page }) => {
    await page.locator('nav').getByText(/gastos|expenses/i).click();
    await page.waitForURL('/expenses');
    // The button's accessible name is the full label; it now also renders the
    // short visible text "Importar" beside the upload icon.
    const importBtn = page.getByRole('button', { name: /importar gastos e movimenta/i });
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toContainText(/importar/i);
  });
});
