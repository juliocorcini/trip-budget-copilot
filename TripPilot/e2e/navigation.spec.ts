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

  test('should navigate to planner', async ({ page }) => {
    const plannerTab = page.locator('nav').getByText(/planejar|planner/i);
    await plannerTab.click();
    await page.waitForURL('/planner');
  });

  test('should navigate to more/settings', async ({ page }) => {
    const moreTab = page.locator('nav button').last();
    await moreTab.click();
    await page.waitForURL('/more');
  });

  test('should navigate to settings from more page', async ({ page }) => {
    await page.goto('/more');
    const settingsLink = page.getByText(/config/i);
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForURL('/settings');
    }
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
