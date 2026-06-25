import { test, expect } from '@playwright/test';

// Grupos, Sincronia & Nuvem — G1 (1.2.0-rc): group-split IA + nav loop.
// Covers B01 (back loop), A03/A04 (Expenses-first; "Saldos" renamed; balances
// behind a button) and A02 (add-person keeps focus). QR (A06) needs a published
// board (network) and is verified by the manual smoke matrix (§15).

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

test.describe('Groups wave G1 — IA + nav loop', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('back from a group lands on the list and does not loop (B01)', async ({ page }) => {
    await createGroup(page, 'G1 Nav');
    // In-page back → the list (a pop, not a fresh push of /groups).
    await page.getByRole('button', { name: /voltar|back/i }).first().click();
    await expect(page).toHaveURL(/\/groups$/);
    // One more back must LEAVE the groups area — not ping-pong into the detail.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/groups\/[^/]+$/);
  });

  test('expenses are the primary section and "Saldos" is gone (A03/A04)', async ({ page }) => {
    await createGroup(page, 'G1 IA');
    await expect(page.getByRole('heading', { name: /despesas|expenses/i })).toBeVisible();
    // The old hard word is removed from the UI everywhere.
    await expect(page.getByText(/^Saldos$/)).toHaveCount(0);
    // With no expenses yet, the balances button does not even render.
    await expect(page.getByRole('button', { name: /^pagamentos$|^payments$|^pagos$/i })).toHaveCount(0);
  });

  test('adding a person keeps the keyboard focus on the field (A02)', async ({ page }) => {
    await createGroup(page, 'G1 Focus');
    const input = page.getByPlaceholder(/nome da pessoa|name|nombre/i).first();
    await input.fill('Bruno');
    await page.getByRole('button', { name: /^adicionar$|^add$/i }).first().click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
  });
});
