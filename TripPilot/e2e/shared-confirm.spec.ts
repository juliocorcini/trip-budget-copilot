import { test, expect } from '@playwright/test';

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('Shared expenses confirmation + settle (DEC-071)', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('pending card → confirm shares → card disappears', async ({ page }) => {
    // Demo data seeds pending third-party shares → dashboard card visible
    const pendingCard = page.getByText(/aguardando confirmação/i);
    await expect(pendingCard).toBeVisible();
    await pendingCard.click();

    // Confirmation sheet: confirm every pending share
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const confirmButtons = sheet.getByRole('button', { name: /^confirmar$/i });
    const total = await confirmButtons.count();
    for (let i = 0; i < total; i++) {
      // List shrinks as shares get confirmed — always click the first remaining
      await confirmButtons.first().click();
    }

    // Card must disappear once nothing is pending
    await expect(page.getByText(/aguardando confirmação/i)).toHaveCount(0);
  });

  test('settle a pending debt from the shared page', async ({ page }) => {
    await page.goto('/shared');
    const settleButton = page.getByRole('button', { name: /liquidar/i }).first();
    await expect(settleButton).toBeVisible();
    await settleButton.click();

    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(/confirmar acerto/i)).toBeVisible();
    await sheet.getByRole('button', { name: /^liquidar$/i }).click();

    // Either everything settled or settlements list now shows the entry
    await expect(
      page.getByText(/tudo acertado|liquidações realizadas/i).first()
    ).toBeVisible();
  });
});
