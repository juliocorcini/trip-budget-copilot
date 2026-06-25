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

/**
 * C17 (DEC-298 sibling) — simple mode hides the advanced "Device & capture"
 * category from the card list, but never removes it: search and the direct
 * deep-link still reach every option (ÂNCORA 9).
 */
const DEVICE_CARD = /dispositivo e captura|device & capture|dispositivo y captura/i;

test.describe('Settings — simple mode hides advanced category (C17)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the Device category drops off the simple-mode list but stays searchable', async ({ page }) => {
    // Complete mode (the demo default) shows the Device card on the bare list.
    await page.goto('/settings');
    await expect(page.getByText(DEVICE_CARD)).toBeVisible();

    // Switch to simple mode from Preferences.
    await page.goto('/settings/c/preferences');
    await page.getByRole('button', { name: /^simples$|^simple$/i }).click();

    // The advanced Device card is gone from the bare list…
    await page.goto('/settings');
    await expect(page.getByText(DEVICE_CARD)).toHaveCount(0);

    // …but search still surfaces it (ÂNCORA 9 — nothing removed).
    await page.getByPlaceholder(/buscar|search/i).fill('armazenamento');
    await expect(page.getByText(DEVICE_CARD)).toBeVisible();
  });

  test('the Device deep-link still opens in simple mode', async ({ page }) => {
    await page.goto('/settings/c/preferences');
    await page.getByRole('button', { name: /^simples$|^simple$/i }).click();
    // Direct deep-link bypasses the hidden card entirely.
    await page.goto('/settings/c/device');
    await expect(page.getByText(/armazenamento|storage|almacenamiento/i).first()).toBeVisible();
  });
});
