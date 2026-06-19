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
    // Demo data seeds a CONNECTED-pending share (Beto, DEC-241) → dashboard card visible
    const pendingCard = page.getByText(/aguardando aceite/i);
    await expect(pendingCard).toBeVisible();
    await pendingCard.click();

    // Confirmation sheet: confirm every pending share
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const confirmButtons = sheet.getByRole('button', { name: /^confirmar$/i });
    // Wait for at least one share row to render before confirming — the model
    // loads pending shares asynchronously, so a bare count() can race to zero.
    await expect(confirmButtons.first()).toBeVisible();
    // The list shrinks (and the model reloads) after each confirmation, so keep
    // confirming the first remaining row and wait for the count to drop by one.
    let remaining = await confirmButtons.count();
    while (remaining > 0) {
      await confirmButtons.first().click();
      await expect(confirmButtons).toHaveCount(remaining - 1);
      remaining -= 1;
    }

    // Card must disappear once nothing is pending
    await expect(page.getByText(/aguardando aceite/i)).toHaveCount(0);
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
