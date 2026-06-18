import { test, expect } from '@playwright/test';

/**
 * GATE 9 (audit 4.4, P2) — the expense-list filter chips are now grouped and
 * labelled behind a collapsible "Filtros" toggle, and the "Saídas" tab carries a
 * one-line explainer of what an outing is. Anti-regression: nothing removed —
 * every scope filter is still reachable, one tap away.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 9 — expense-list filter clarity', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
    await page.goto('/expenses');
  });

  test('filter groups are collapsed by default and reveal labelled chips on toggle', async ({
    page,
  }) => {
    // Collapsed: the "Filtros" toggle is present, but no group label is in the DOM yet.
    const toggle = page.getByRole('button', { name: /filtros|filters/i });
    await expect(toggle).toBeVisible();
    await expect(page.getByText('Categorias', { exact: true })).toHaveCount(0);

    // Expand → the "Categorias" group label and its chips appear.
    await toggle.click();
    await expect(page.getByText('Categorias', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bar', exact: true })).toBeVisible();

    // Selecting a category narrows the feed; the badge then counts it.
    await page.getByRole('button', { name: 'Bar', exact: true }).click();
    await expect(page.getByRole('button', { name: /filtros|filters/i })).toContainText('1');
  });

  test('the Saídas tab explains what an outing is', async ({ page }) => {
    await page.getByRole('button', { name: /^Saídas$|^Outings$/ }).click();
    await expect(page.getByText(/agrupa os gastos de um rolê/i)).toBeVisible();
  });
});
