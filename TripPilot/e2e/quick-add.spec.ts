import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Quick Add expense', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('should navigate to quick-add page', async ({ page }) => {
    await page.goto('/quick-add');
    await expect(page).toHaveURL('/quick-add');
  });

  test('should show expense form fields', async ({ page }) => {
    await page.goto('/quick-add');
    await expect(page.locator('input, select, textarea').first()).toBeVisible();
  });
});
