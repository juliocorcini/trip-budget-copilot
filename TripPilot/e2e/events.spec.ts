import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('Planned events (DEC-072 — FIELD-05)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('create event for today → day card appears on dashboard', async ({ page }) => {
    await page.goto('/trip/edit');
    await expect(page.getByText(/eventos desta fase/i).first()).toBeVisible();

    // Open "+ Evento" on the first (active) phase
    await page.getByRole('button', { name: /Evento$/ }).first().click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.locator('input[type="text"]').fill('Festa Parral');
    await sheet.locator('input[type="date"]').first().fill(todayString());
    const numberInputs = sheet.locator('input[type="number"]');
    await numberInputs.nth(0).fill('80');
    await numberInputs.nth(1).fill('50');
    await sheet.getByRole('button', { name: /^salvar$/i }).click();

    // Event listed in the phase section
    await expect(page.getByText('Festa Parral')).toBeVisible();

    // Dashboard shows the day card with start action (M6.3)
    await page.goto('/dashboard');
    await expect(page.getByText(/hoje: festa parral/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar agora/i })).toBeVisible();
  });
});
