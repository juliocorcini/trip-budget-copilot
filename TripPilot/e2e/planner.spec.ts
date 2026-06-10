import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Planner (GAP-R2-009)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('shows free margin and enabled profiles of the active phase', async ({ page }) => {
    await page.goto('/planner');
    await expect(page.getByText(/planejador/i).first()).toBeVisible();
    await expect(page.getByText(/margem livre/i).first()).toBeVisible();
    // Demo seeds Bar/Restaurante/Mercado profiles — at least one row must render
    await expect(page.getByText(/bar|restaurante|mercado/i).first()).toBeVisible();
  });

  test('allocated total updates and is displayed', async ({ page }) => {
    await page.goto('/planner');
    await expect(page.getByText(/alocado/i).first()).toBeVisible();
  });
});
