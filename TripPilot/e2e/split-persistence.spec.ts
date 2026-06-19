import { test, expect, type Page } from '@playwright/test';

/**
 * The "saída de bar" persistence: once a division is live it must follow the
 * user everywhere until it is really closed.
 *   1. Start a live table, then leave the split screen.
 *   2. The HOME shows an active-split card; OTHER tabs show a floating chip.
 *   3. Tapping "Dividir conta" on the FAB now asks resume-or-new.
 *   4. "Ver divisão completa" opens the full who-got-what history.
 *   5. "Encerrar → Registrar" turns it into an expense AND clears the card/chip.
 *
 * Runs against the dev server (default) or a deployed baseURL.
 */

const SHOTS = 'test-results/split-persistence';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

async function addItem(page: Page, trigger: RegExp, name: string, price: string): Promise<void> {
  await page.getByRole('button', { name: trigger }).click();
  const editor = page.getByRole('dialog', { name: 'Editar item' });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.locator('input').first().fill(name);
  await editor.locator('input[type="number"]').fill(price);
  await editor.getByRole('button', { name: 'Pronto' }).click();
  await expect(editor).toBeHidden();
}

async function startLiveTable(page: Page): Promise<void> {
  await page.goto('/split/scan');
  await expect(page.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();
  await addItem(page, /Adicionar manualmente/, 'Pizza', '60');
  await page.getByText('Mesa ao vivo').first().click();
  // Once live the share button appears — the table is published + meta persisted.
  await expect(page.getByRole('button', { name: 'Compartilhar link' })).toBeVisible({ timeout: 20_000 });
}

test.describe('Bill split — active-split persistence', () => {
  test.describe.configure({ timeout: 120_000 });

  test('home card, floating chip, FAB resume-or-new, full history, and close-to-expense', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

    await loadDemo(page);
    await startLiveTable(page);

    // ---- HOME: the active-split card surfaces the running table ----
    await page.goto('/dashboard');
    const homeCard = page.getByRole('button', { name: 'Voltar para a divisão ao vivo' });
    await expect(homeCard).toBeVisible({ timeout: 10_000 });
    await expect(homeCard).toContainText('Conta');
    await expect(homeCard).toContainText(/60[.,]00/);
    await page.screenshot({ path: `${SHOTS}/01-home-card.png` });

    // ---- OTHER TAB: a floating chip persists the division ----
    await page.goto('/expenses');
    const chip = page.getByRole('button', { name: 'Voltar para a divisão ao vivo' });
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toContainText(/60[.,]00/);
    await page.screenshot({ path: `${SHOTS}/02-floating-chip.png` });

    // ---- FAB: "Dividir conta" asks resume-or-new while one is live ----
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    await page.getByRole('button', { name: 'Dividir conta' }).click();
    const resumeSheet = page.getByRole('dialog', { name: 'Você tem uma divisão acontecendo' });
    await expect(resumeSheet).toBeVisible({ timeout: 10_000 });
    await expect(resumeSheet.getByRole('button', { name: 'Começar uma nova divisão' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-fab-resume-or-new.png` });

    // Resume → back to the SAME live table (still publishing).
    await resumeSheet.getByRole('button', { name: 'Voltar' }).click();
    await page.waitForURL('**/split/scan', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Compartilhar link' })).toBeVisible({ timeout: 30_000 });

    // ---- HISTORY: the full who-got-what record ----
    await page.getByRole('button', { name: 'Ver divisão completa' }).click();
    const history = page.getByRole('dialog', { name: 'A divisão completa' });
    await expect(history).toBeVisible({ timeout: 10_000 });
    // The owner is in the record, tagged with the "Você" channel, with the pizza.
    await expect(history.getByText('Você').first()).toBeVisible();
    await expect(history.getByText('Pizza')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-full-history.png` });
    await page.keyboard.press('Escape');
    await expect(history).toBeHidden({ timeout: 5_000 });

    // ---- CLOSE: "Encerrar → Registrar" commits the expense ----
    await page.getByRole('button', { name: 'Encerrar' }).click();
    const endSheet = page.getByRole('dialog', { name: 'Encerrar a divisão' });
    await expect(endSheet).toBeVisible({ timeout: 10_000 });
    await endSheet.getByRole('button', { name: 'Registrar como gasto agora' }).click();
    await page.waitForURL('**/expenses', { timeout: 20_000 });

    // The card/chip are gone — the division is really over.
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Voltar para a divisão ao vivo' })).toHaveCount(0, {
      timeout: 10_000,
    });
    await page.screenshot({ path: `${SHOTS}/05-cleared-after-commit.png` });

    await ctx.close();
  });
});
