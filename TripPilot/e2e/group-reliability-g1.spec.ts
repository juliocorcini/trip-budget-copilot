import { test, expect, type Page } from '@playwright/test';

// Grupos Confiáveis & Acerto Claro — G1 (1.3.1-rc): group-split UX quick wins.
// Covers F01 (accordion exclusivity: Pagamentos XOR Quem-paga) and F28 (the
// group-detail header is sticky). F02–F05 are presentation/copy changes covered
// by the unit + component suites; the manual-item math is unit-verified.

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

async function addPerson(page: Page, name: string) {
  const input = page.getByPlaceholder(/nome da pessoa|name|nombre/i).first();
  await input.fill(name);
  await page.getByRole('button', { name: /^adicionar$|^add$/i }).first().click();
  await expect(input).toHaveValue('');
}

async function addExpense(page: Page, description: string, amount: string) {
  await page.getByRole('button', { name: /adicionar despesa|add expense|agregar gasto/i }).first().click();
  await page.getByPlaceholder('Ex.: Churrasco').fill(description);
  await page.getByPlaceholder('0.00').fill(amount);
  await page.getByRole('button', { name: /^salvar$|^save$|^guardar$/i }).click();
}

test.describe('Groups reliability wave G1 — UX quick wins', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('the group-detail header is sticky (F28)', async ({ page }) => {
    await createGroup(page, 'G1 Sticky');
    await expect(page.locator('.page-sticky-header')).toBeVisible();
  });

  test('only one of Pagamentos / Quem-paga is open at a time (F01)', async ({ page }) => {
    await createGroup(page, 'G1 Accordion');
    await addPerson(page, 'Bruno');
    await addExpense(page, 'Bar', '20');

    const balancesBtn = page.getByRole('button', { name: /pagamentos|payments|pagos/i });
    const transfersBtn = page.getByRole('button', { name: /quem paga|who pays|quién paga/i });
    await expect(balancesBtn).toBeVisible();
    await expect(transfersBtn).toBeVisible();

    // Open balances → it is expanded, transfers stays collapsed.
    await balancesBtn.click();
    await expect(balancesBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(transfersBtn).toHaveAttribute('aria-expanded', 'false');

    // Open transfers → balances collapses (exclusivity).
    await transfersBtn.click();
    await expect(transfersBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(balancesBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
