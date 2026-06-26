import { test, expect } from '@playwright/test';

// Grupos, Sincronia & Nuvem — G2 (1.2.1-rc): expense date + day-group + item view.
// Covers A07 (the expense editor has a date that defaults to today and survives a
// round-trip) and the no-regression path for manual entry. Item-selection (A09)
// and the day headers (A12, needs >1 day) ride the OCR cloud / fixtures and are in
// the unit suite + manual smoke matrix (§15); here we lock the always-on UI.

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

async function createGroup(page: import('@playwright/test').Page, name: string) {
  await page.goto('/groups');
  const newBtn = page.getByRole('button', { name: /novo grupo|new group/i });
  if (await newBtn.isVisible().catch(() => false)) await newBtn.click();
  await page.getByRole('textbox').first().fill(name);
  await page.getByRole('button', { name: /^criar$|^create$/i }).click();
  await page.waitForURL(/\/groups\/[^/]+$/);
}

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Groups wave G2 — expense date + manual entry', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('a new expense defaults the date to today and keeps it on edit (A07)', async ({ page }) => {
    await createGroup(page, 'G2 Date');

    // Open the add-expense sheet.
    await page.getByRole('button', { name: /adicionar despesa|add expense|añadir gasto/i }).first().click();

    // The date field is always present and pre-set to today.
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveValue(TODAY);

    // Fill the minimum manual fields and save (owner is the default payer).
    await page.getByPlaceholder(/ex\.: churrasco|e\.g\. barbecue|ej\.: asado/i).fill('G2 Lunch');
    await page.getByPlaceholder('0.00').first().fill('40');
    await page.getByRole('button', { name: /^salvar$|^save$|^guardar$/i }).click();

    // The expense lands in the list (no day header for a single-day group).
    const row = page.getByText('G2 Lunch');
    await expect(row).toBeVisible();

    // Re-open it: the date round-trips (still today, not blanked or re-stamped).
    await row.click();
    await expect(page.locator('input[type="date"]')).toHaveValue(TODAY);
  });
});
