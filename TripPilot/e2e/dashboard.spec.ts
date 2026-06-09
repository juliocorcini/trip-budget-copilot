import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('should show free-to-spend hero metric', async ({ page }) => {
    const heroSection = page.locator('.bg-surface-container').first();
    await expect(heroSection).toBeVisible();
  });

  test('should show budget pools with progress bars', async ({ page }) => {
    const pools = page.locator('.bg-surface-container .h-2');
    await expect(pools.first()).toBeVisible();
  });

  test('should show demo banner when in demo mode', async ({ page }) => {
    const banner = page.locator('[class*="warning"]').first();
    await expect(banner).toBeVisible();
  });

  test('should navigate to expenses via bottom nav', async ({ page }) => {
    const expensesNav = page.locator('nav').getByText(/gastos|expenses/i);
    await expensesNav.click();
    await page.waitForURL('/expenses');
  });

  test('should navigate to expenses list via view all', async ({ page }) => {
    const viewAll = page.getByText(/ver todos|view all/i);
    if (await viewAll.isVisible()) {
      await viewAll.click();
      await page.waitForURL('/expenses');
    }
  });
});
