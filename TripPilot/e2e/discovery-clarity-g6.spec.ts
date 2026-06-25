import { test, expect, type Page } from '@playwright/test';

/**
 * Discovery & Clarity — Gate 6 (D07 · DEC-320): per-item price history.
 *  - An item with ≥2 purchases (matched by normalized description) shows a price
 *    history card on its detail page: min/avg/max + a "vs your average" verdict and
 *    the full purchase list one tap away.
 *  - An item with no prior purchase shows NO card (the ≥2 guard).
 *
 * Demo data (demo-data.ts) seeds 10 expenses with DISTINCT descriptions, so the
 * positive case creates a second purchase of a novel item, and the negative case
 * opens one of the unique demo items ("Sorvete artesanal").
 */

const SAVE = /^(salvar|save|guardar)$/i;
const SEE_ALL = /ver todas as compras|see all purchases|ver todas las compras/i;
const THIS_ONE = /esta compra|this purchase/i;

const ITEM = 'Item teste G6';

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

/** Creates one expense via Quick Add. `cat=other` keeps the category fixed (no
 *  sticky override, no transport round-trip) and has no demo typical (no anomaly). */
async function addExpense(page: Page, amount: string, description: string) {
  await page.goto('/quick-add?cat=other');
  await page.locator('input[placeholder="0,00"]').first().fill(amount);
  await page.locator('[data-quickadd-description]').fill(description);
  await page.getByRole('button', { name: SAVE }).click();
  await page.waitForURL('/dashboard');
}

async function openExpenseByText(page: Page, text: string) {
  await page.goto('/expenses');
  await page.locator('[data-expense-row]').filter({ hasText: text }).first().click();
  await page.waitForURL(/\/expenses\/.+/);
}

test.describe('Discovery & Clarity G6 — per-item price history (D07)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('an item bought twice shows its price history, with the current buy flagged', async ({
    page,
  }) => {
    await addExpense(page, '8,00', ITEM);
    await addExpense(page, '12,00', ITEM);

    await openExpenseByText(page, ITEM);

    const card = page.locator('[data-price-history]');
    await expect(card).toBeVisible();
    // The count line names the item and the number of purchases (2).
    await expect(card).toContainText(/2\s+(vezes|times|veces)/i);
    // Min / Average / Max stat labels are all present.
    await expect(card.getByText(/menor|lowest|mínimo/i)).toBeVisible();
    await expect(card.getByText(/média|average|promedio/i)).toBeVisible();
    await expect(card.getByText(/maior|highest|máximo/i)).toBeVisible();

    // The full list is one tap away and flags THIS purchase.
    await card.getByRole('button', { name: SEE_ALL }).click();
    await expect(card.getByText(THIS_ONE)).toBeVisible();
  });

  test('an item with no prior purchase shows no price history card', async ({ page }) => {
    // "Sorvete artesanal" is a unique demo expense (single occurrence).
    await openExpenseByText(page, 'Sorvete artesanal');
    await expect(page.locator('[data-price-history]')).toHaveCount(0);
  });
});
