import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('App navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('should have bottom navigation with 4 tabs plus central FAB', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    const links = nav.locator('a, button');
    await expect(links).toHaveCount(5);
  });

  test('should navigate to viagem', async ({ page }) => {
    const viagemTab = page.locator('nav').getByText(/viagem|trip/i);
    await viagemTab.click();
    await page.waitForURL('/viagem');
  });

  test('should navigate to copiloto', async ({ page }) => {
    const copilotoTab = page.locator('nav').getByText(/copiloto|copilot/i);
    await copilotoTab.click();
    await page.waitForURL('/copiloto');
  });

  test('should open settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
  });

  test('should navigate to simulator', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page).toHaveURL('/simulator');
  });

  test('should navigate to shared expenses', async ({ page }) => {
    await page.goto('/shared');
    await expect(page).toHaveURL('/shared');
  });

  test('should navigate to outing mode', async ({ page }) => {
    await page.goto('/outings/new');
    await expect(page).toHaveURL('/outings/new');
  });
});
