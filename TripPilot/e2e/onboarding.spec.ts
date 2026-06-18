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

    // M16: the default path is the 1-question "quick" flow — only the amount and
    // the end date are required, everything else is defaulted/optional.
    await page.locator('input[type="number"]').first().fill('3000');
    await page.locator('input[type="date"]').first().fill('2026-07-15');
    await page.locator('input[type="text"]').first().fill('Europa 2026');

    // The CTA only enables once amount + end date are present.
    const nextButton = page.getByRole('button', { name: /próximo|next/i });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Closing step: choose the UX mode — this is what finishes onboarding.
    const simpleMode = page.getByRole('button', { name: /começar simples|simple/i });
    await expect(simpleMode).toBeVisible({ timeout: 5000 });
    // G14 (audit §4.1): the first-timer gets a recommended default on the simple option.
    await expect(simpleMode.getByText(/recomendado|recommended/i)).toBeVisible();
    await simpleMode.click();

    await page.waitForURL('/dashboard', { timeout: 15000 });
  });
});
