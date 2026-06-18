import { test, expect } from '@playwright/test';

/**
 * GATE 14 (audit §4.17) — "Conexões e compartilhamento" broke out of the
 * over-broad "Dados e segurança" group. This guards the split end-to-end:
 * the new category exists and owns the pairing/mailbox/receipt sections, and
 * the data/security group keeps the backup/lock/reset core (nothing lost).
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Settings — Connections category (G14)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the Connections category exists and owns the sharing sections', async ({ page }) => {
    await page.goto('/settings/c/connections');
    // The pairing/links entry moved here from "Dados e segurança".
    await expect(page.getByText(/pessoas e aparelhos conectados|people and devices/i)).toBeVisible();
  });

  test('the data & security category keeps its core and drops the moved sections', async ({ page }) => {
    await page.goto('/settings/c/data_security');
    // The app-lock core still lives here…
    await expect(page.getByText(/bloqueio do app|app lock/i)).toBeVisible();
    // …and the connections link is no longer in this group.
    await expect(page.getByText(/pessoas e aparelhos conectados|people and devices/i)).toHaveCount(0);
  });

  test('search still surfaces a moved section from the bare settings list', async ({ page }) => {
    await page.goto('/settings');
    await page.getByPlaceholder(/buscar|search/i).fill('pareamento');
    await expect(page.getByText(/pessoas e aparelhos conectados|people and devices/i)).toBeVisible();
  });
});
