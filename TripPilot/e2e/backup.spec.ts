import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Backup export/import round-trip (GAP-R2-009)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('export JSON then import the same file (merge)', async ({ page }) => {
    await page.goto('/settings/backup');

    // Export → capture the downloaded file
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /exportar backup json/i }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Import the exported file → preview with merge mode
    await page.locator('input[type="file"]').setInputFiles(filePath as string);
    await expect(page.getByText(/resumo da importação/i)).toBeVisible();
    await page.getByRole('button', { name: /mesclar com dados locais/i }).click();
    await page.getByRole('button', { name: /^confirmar$/i }).click();

    await expect(page.getByText(/importação concluída/i)).toBeVisible();
  });
});
