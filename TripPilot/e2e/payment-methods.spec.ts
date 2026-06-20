import { test, expect, type Page } from '@playwright/test';

/**
 * G4 (DEC-244) — user-defined payment methods. The owner publishes how people
 * can pay them back (Pix/Wise/bank/free text); enabled methods are appended to
 * the settle-up reminder. This guards the editor end-to-end: add → persists
 * across reload → enable/disable drives the live preview (the same block that
 * the "Lembrar" message appends).
 */
async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('G4 — payment methods editor', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the Connections category links to the payment-methods editor', async ({ page }) => {
    await page.goto('/settings/c/connections');
    await expect(page.getByText(/formas de pagamento|payment methods|formas de pago/i).first()).toBeVisible();
  });

  test('add a Pix method → it appears in the preview and persists across reload', async ({ page }) => {
    await page.goto('/settings/payment-methods');

    // Pix is the default kind; fill the value and add.
    await page.locator('[data-payment-add-value]').fill('john@example.com');
    await page.locator('[data-payment-add-submit]').click();

    // The row exists and the live preview carries the header + the value.
    await expect(page.locator('[data-payment-row]')).toHaveCount(1);
    const preview = page.locator('[data-payment-preview]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(/pode pagar por|you can pay via|puedes pagar con/i);
    await expect(preview).toContainText('john@example.com');

    await page.screenshot({ path: 'test-results/payment-methods/added.png' });

    // Persistence: reload the page and the method is still there.
    await page.reload();
    await expect(page.locator('[data-payment-row]')).toHaveCount(1);
    await expect(page.locator('[data-payment-preview]')).toContainText('john@example.com');
  });

  test('disabling a method removes it from the appended block', async ({ page }) => {
    await page.goto('/settings/payment-methods');
    await page.locator('[data-payment-add-value]').fill('@traveler');
    await page.locator('[data-payment-add-submit]').click();
    await expect(page.locator('[data-payment-preview]')).toContainText('@traveler');

    // The eye toggle (last-but-one action in the row) disables it.
    await page
      .locator('[data-payment-row]')
      .first()
      .getByRole('button', { name: /desativar|disable|desactivar/i })
      .click();

    // With the only method disabled, the preview block disappears entirely.
    await expect(page.locator('[data-payment-preview]')).toHaveCount(0);
  });
});
