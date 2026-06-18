import { test, expect, type Page } from '@playwright/test';

/**
 * Bill split (G2) — proves the live table wiring on the front:
 *  • Owner: the divide board offers the "Mesa ao vivo" invite (LiveTableCard).
 *  • Guest: the /t/:id route mounts OUTSIDE BootGate (a guest with no trip is
 *    never bounced to onboarding) and renders the explained error UI for a dead
 *    link. The owner↔guest claim loop itself is covered by the domain unit
 *    suites (share payload + owner-reducer); this guards the routes + copy.
 */

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Bill split — live table (G2)', () => {
  test.describe.configure({ timeout: 90_000 });

  test('owner divide board offers the live table invite', async ({ page }) => {
    await loadDemo(page);
    await page.goto('/split/scan');
    await expect(page.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();

    await page.getByRole('button', { name: /Adicionar manualmente/ }).click();
    const editor = page.getByRole('dialog', { name: 'Editar item' });
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.locator('input').first().fill('Pizza');
    await editor.locator('input[type="number"]').fill('60');
    await editor.getByRole('button', { name: 'Pronto' }).click();
    await expect(editor).toBeHidden();

    // The live-table invite is present on the divide board.
    await expect(page.getByText('Mesa ao vivo')).toBeVisible();
    await expect(page.getByText(/Mande um link/)).toBeVisible();
  });

  test('guest /t/:id mounts outside BootGate and explains a dead link', async ({ page }) => {
    await page.goto('/t/00000000-0000-4000-8000-000000000000#k=not-a-real-key');

    // Never bounced to onboarding/welcome — the guest route stands on its own.
    await expect(page).toHaveURL(/\/t\//);
    // The error UI resolves (revoked / not found / bad key / offline all share
    // the "go home" affordance) — the spinner must not hang forever.
    await expect(page.getByRole('button', { name: /Ir para o início/ })).toBeVisible({ timeout: 15_000 });
  });
});
