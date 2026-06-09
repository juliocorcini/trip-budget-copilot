import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test('should show welcome page on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /criar/i })).toBeVisible();
  });

  test('should load demo data and navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('.bg-surface-container').first()).toBeVisible({ timeout: 10000 });
  });

  test('should complete trip creation onboarding', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const createButton = page.getByRole('button', { name: /criar/i });
    await createButton.click();
    await page.waitForURL('/onboarding');

    const textInputs = page.locator('input[type="text"]');
    await textInputs.first().fill('Europa 2026');
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.first().fill('2026-07-01');
    await dateInputs.last().fill('2026-07-15');

    const nextButton = page.getByRole('button', { name: /próximo|next/i });
    await nextButton.click();

    await page.waitForTimeout(500);
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('3000');

    // Steps: trip → budget → owner → wallets (GAP-026 / DEC-051).
    await nextButton.click();
    await page.waitForTimeout(500);
    await nextButton.click();
    await page.waitForTimeout(500);

    const finishButton = page.getByRole('button', { name: /começar|finalizar|finish/i });
    await expect(finishButton).toBeVisible({ timeout: 5000 });
    await finishButton.click();

    await page.waitForURL('/dashboard', { timeout: 15000 });
  });
});
