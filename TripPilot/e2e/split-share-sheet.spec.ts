import { test, expect, type Page } from '@playwright/test';

/**
 * The owner's share affordance after creating a live table must offer THREE
 * explicit channels — a scannable QR, copy link, and the OS share sheet — in a
 * modal, instead of the old single button that silently copied inside the app.
 */

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Bill split — share sheet (QR + copy + share)', () => {
  test.describe.configure({ timeout: 90_000 });

  test('tapping share opens a modal with QR, copy and share', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadDemo(page);
    await page.goto('/split/scan');

    await page.getByRole('button', { name: /Adicionar manualmente/ }).click();
    const editor = page.getByRole('dialog', { name: 'Editar item' });
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.locator('input').first().fill('Pizza');
    await editor.locator('input[type="number"]').fill('60');
    await editor.getByRole('button', { name: 'Pronto' }).click();
    await expect(editor).toBeHidden();

    await page.getByText('Mesa ao vivo').click();
    const shareBtn = page.getByRole('button', { name: 'Compartilhar link' });
    await expect(shareBtn).toBeVisible({ timeout: 20_000 });
    await shareBtn.click();

    // Modal: QR image + both explicit actions, scoped to the share dialog.
    const sheet = page.getByRole('dialog', { name: 'Compartilhar a mesa' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByRole('img', { name: 'QR code' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Copiar link' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Compartilhar link' })).toBeVisible();

    // Copy actually writes the live link to the clipboard.
    await sheet.getByRole('button', { name: 'Copiar link' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('/t/');
  });
});
