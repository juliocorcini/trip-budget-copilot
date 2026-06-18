import { test, expect, type Page } from '@playwright/test';

/**
 * GATE 12 (audit §4.12) — the Outing start screen now names what an outing IS
 * before asking which type, so the concept ("a capped night out, logged in one
 * tap") is no longer an unannounced model. Anti-regression: the picker and the
 * safe-value hint are untouched.
 */
async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 12 — outing opener microcopy', () => {
  test('the start screen explains what an outing is', async ({ page }) => {
    await loadDemoData(page);
    await page.goto('/outings/new');
    await expect(page.getByText(/Uma saída é um rolê com teto/i)).toBeVisible();
    // The picker still leads to choosing a type (nothing removed).
    await expect(page.getByText(/Escolha o tipo de saída/i)).toBeVisible();
  });
});
