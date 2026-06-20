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

  // v0.99.10 (DEC-244): discoverability — when someone owes the owner (demo: Ana)
  // and NO method is configured, /shared nudges the owner to add one; the nudge
  // links to the editor and self-hides once a method exists.
  test('the /shared hint shows when owed + none configured, links to the editor', async ({ page }) => {
    await page.goto('/shared');
    const hint = page.locator('[data-add-payment-hint]');
    await expect(hint).toBeVisible();
    await hint.click();
    await expect(page).toHaveURL(/\/settings\/payment-methods$/);
  });

  // The end-to-end proof the user asked for: a configured method actually rides
  // along in the real "Lembrar" message sent from the /shared debt row.
  test('the Lembrar message carries the payment instructions end-to-end', async ({ page }) => {
    // Capture whatever is handed to the OS share sheet (Web Share API path).
    await page.addInitScript(() => {
      (window as unknown as { __shared: unknown[] }).__shared = [];
      try {
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: (data: unknown) => {
            (window as unknown as { __shared: unknown[] }).__shared.push(data);
            return Promise.resolve();
          },
        });
      } catch {
        /* navigator.share may be locked down — clipboard fallback still works */
      }
    });

    // Publish a Pix method, then go collect.
    await page.goto('/settings/payment-methods');
    await page.locator('[data-payment-add-value]').fill('john@example.com');
    await page.locator('[data-payment-add-submit]').click();
    await expect(page.locator('[data-payment-row]')).toHaveCount(1);

    await page.goto('/shared');
    // The hint must be gone now that a method exists (self-hiding).
    await expect(page.locator('[data-add-payment-hint]')).toHaveCount(0);

    // Fire "Lembrar" on the debtor who owes the owner.
    await page.getByRole('button', { name: /lembrar|remind|recordar/i }).first().click();

    const shared = await page.evaluate(
      () => (window as unknown as { __shared: { text?: string }[] }).__shared,
    );
    expect(shared.length).toBeGreaterThan(0);
    const text = shared[0]?.text ?? '';
    // Carries the debt reminder AND the published Pix value + the "pay via" header.
    expect(text).toContain('john@example.com');
    expect(text).toMatch(/pode pagar por|you can pay via|puedes pagar con/i);
    expect(text).toMatch(/me deve|owe|debe/i);
  });
});
