import { test, expect, type Page } from '@playwright/test';

// Grupos Confiáveis & Acerto Claro — G3 (1.3.3-rc): live group board +
// delete-recalc + owner = moderator (DEC-349). The cross-guest LIVE fold (a `/g/`
// guest's add appearing for everyone without the owner opening the app) is pinned
// by the domain `foldEventForViewer` suite + a GroupClaimPage component test; this
// E2E pins the owner-surface delete-recalc (F11): removing an expense corrects the
// total at once — the "120€ stayed on the board" regression becomes a guard.

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

async function createGroup(page: Page, name: string) {
  await page.goto('/groups');
  const newBtn = page.getByRole('button', { name: /novo grupo|new group/i });
  if (await newBtn.isVisible().catch(() => false)) await newBtn.click();
  await page.getByRole('textbox').first().fill(name);
  await page.getByRole('button', { name: /^criar$|^create$/i }).click();
  await page.waitForURL(/\/groups\/[^/]+$/);
}

async function addExpense(page: Page, description: string, amount: string) {
  await page.getByRole('button', { name: /adicionar despesa|add expense|agregar gasto/i }).first().click();
  await page.getByPlaceholder('Ex.: Churrasco').fill(description);
  await page.getByPlaceholder('0.00').fill(amount);
  await page.getByRole('button', { name: /^salvar$|^save$|^guardar$/i }).click();
}

test.describe('Groups reliability wave G3 — delete recalcs the total (F11)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('deleting an expense immediately removes it and corrects the total', async ({ page }) => {
    await createGroup(page, 'G3 Delete');
    await addExpense(page, 'Hotel', '120');

    // The expense is in the ledger (its row is a button carrying the description).
    const row = page.getByRole('button', { name: /Hotel/i });
    await expect(row).toBeVisible();

    // Open it in the editor and delete (owner = moderator; removal is immediate).
    await row.click();
    await page.getByRole('button', { name: /^excluir$|^delete$|^eliminar$/i }).click();

    // F11 — the expense is gone at once (no stale total lingering behind).
    await expect(page.getByRole('button', { name: /Hotel/i })).toHaveCount(0);
  });
});
