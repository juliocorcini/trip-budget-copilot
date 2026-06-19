import { test, expect, type Page } from '@playwright/test';

/**
 * Pass-the-phone (round-the-table) — proves the guided single-device flow the
 * owner runs at the table: hand the phone around, each person names themselves
 * and marks the items they had, then "next" passes it on. Afterwards the people
 * exist on the board and the full history reads back "esse item foi pra quem".
 * The claim math is covered by the domain suite; this guards the wiring + copy.
 */

const SHOTS = '.ux-shots/split';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

async function addItem(page: Page, name: string, amount: string): Promise<void> {
  const editor = page.getByRole('dialog', { name: 'Editar item' });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.locator('input').first().fill(name);
  await editor.locator('input[type="number"]').fill(amount);
  await editor.getByRole('button', { name: 'Pronto' }).click();
  await expect(editor).toBeHidden();
}

test.describe('Bill split — passar o celular pela mesa', () => {
  test.describe.configure({ timeout: 90_000 });

  test('round-the-table: two people each mark their item, history reads who-got-what', async ({ page }) => {
    await loadDemo(page);
    await page.goto('/split/scan');
    await expect(page.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();

    // Two items on the bill (Pizza for one person, Cerveja for the other).
    await page.getByRole('button', { name: /Adicionar manualmente/ }).click();
    await addItem(page, 'Pizza', '60');
    await page.getByRole('button', { name: 'Adicionar item' }).click();
    await addItem(page, 'Cerveja', '20');
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Cerveja')).toBeVisible();

    // Open the guided flow.
    await page.getByRole('button', { name: /Passar o celular pela mesa/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Passar o celular' });
    await expect(sheet).toBeVisible();

    // Person 1 — Zeca takes the Pizza.
    await sheet.getByPlaceholder('Nome da pessoa').fill('Zeca');
    await sheet.getByRole('button', { name: 'Marcar meus itens' }).click();
    await sheet.getByRole('button').filter({ hasText: 'Pizza' }).click();
    await page.screenshot({ path: `${SHOTS}/pass-phone-pick.png`, fullPage: true });
    await sheet.getByRole('button', { name: /Próximo/ }).click();

    // Person 2 — Bia takes the Cerveja.
    await sheet.getByPlaceholder('Nome da pessoa').fill('Bia');
    await sheet.getByRole('button', { name: 'Marcar meus itens' }).click();
    await sheet.getByRole('button').filter({ hasText: 'Cerveja' }).click();
    await sheet.getByRole('button', { name: 'Concluir' }).click();
    await expect(sheet).toBeHidden();

    // Both people are now on the board (chip text mixes in icon/initials glyphs,
    // so match on the active-person selector buttons).
    await expect(page.getByRole('button', { name: /Zeca/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Bia/ }).first()).toBeVisible();

    // The full history reads back who took what, by item: "esse item foi pra quem".
    await page.getByRole('button', { name: 'Ver divisão completa' }).click();
    const history = page.getByRole('dialog', { name: 'A divisão completa' });
    await expect(history).toBeVisible();
    await history.getByRole('button', { name: 'Por item' }).click();
    await expect(history.getByText('Pizza')).toBeVisible();
    await expect(history.getByText('Cerveja')).toBeVisible();
    await expect(history.getByText('Zeca', { exact: true })).toBeVisible();
    await expect(history.getByText('Bia', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/pass-phone-history.png`, fullPage: true });
  });
});
