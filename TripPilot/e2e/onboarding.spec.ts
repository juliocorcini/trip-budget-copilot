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

    // DEC-252: onboarding now opens with a required identity step (owner name +
    // an optional, local-only e-mail). The name is the only text input here, and
    // the footer CTA stays disabled until it is filled.
    const nextButton = page.getByRole('button', { name: /próximo|next/i });
    await expect(nextButton).toBeDisabled();
    await page.locator('input[type="text"]').first().fill('Julio');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // M16: the default path is the 1-question "quick" flow — only the amount and
    // the end date are required, everything else is defaulted/optional.
    await page.locator('input[type="number"]').first().fill('3000');
    await page.locator('input[type="date"]').first().fill('2026-07-15');
    await page.locator('input[type="text"]').first().fill('Europa 2026');

    // The CTA only enables once amount + end date are present.
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

  // DEC-290 (G3): the Welcome now offers a second primary path — a continuous
  // "Dia a dia" space — that finishes onboarding just like a trip.
  test('should create a day-to-day space from the Welcome', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const dailyButton = page.getByRole('button', { name: /dia a dia|day-to-day|día a día/i });
    await expect(dailyButton).toBeVisible();
    await dailyButton.click();
    await page.waitForURL(/\/onboarding\?kind=ongoing/);

    // Shared identity step: the owner name is the only required field.
    const nextButton = page.getByRole('button', { name: /próximo|next/i });
    await expect(nextButton).toBeDisabled();
    await page.locator('input[type="text"]').first().fill('Julio');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Day-to-day step: name + optional monthly cap — nothing is required, so a
    // "just track, no limit" space can be created by moving straight on.
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Mode chooser finishes onboarding (sets appMode + onboardingCompleted).
    const simpleMode = page.getByRole('button', { name: /começar simples|simple/i });
    await expect(simpleMode).toBeVisible({ timeout: 5000 });
    await simpleMode.click();

    await page.waitForURL('/dashboard', { timeout: 15000 });
  });

  // DEC-290 / ANCHOR 9: the redesign demotes (never removes) the prior entries.
  test('Welcome keeps two primary choices and the three secondary entries', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /criar viagem|create trip|crear viaje/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dia a dia|day-to-day|día a día/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /importar backup|import backup|importar copia/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /receber de outro|receive from|recibir de otro/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /demonstração|demo|demostración/i })).toBeVisible();
  });
});
