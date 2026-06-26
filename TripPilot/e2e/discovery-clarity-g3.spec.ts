import { test, expect } from '@playwright/test';

/**
 * Discovery & Clarity — Gate 3.
 *  - D02 · DEC-307/308: a discreet home doorway → the discovery hub, where the
 *    user finds a function by browsing intent or searching (reuses searchHelp).
 *  - D03/D04 · DEC-309/310: the single "Dividir" door in the FAB opens a chooser
 *    that explains bill-split vs group-split BEFORE routing to either intact flow.
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Discovery & Clarity G3 — discovery hub + "Dividir" chooser', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // D02 — browse: find a function from the hub and open it.
  test('home header opens the discovery hub and a browse entry opens its screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Descobrir' }).click();
    await page.waitForURL('/descobrir');
    await expect(page.getByRole('heading', { name: 'Descobrir' })).toBeVisible();

    // The browse view lists everything you can do; open the currency converter.
    await page.getByText('Conversor de moedas').click();
    await page.waitForURL('/converter');
  });

  // D02 — search: typing an intent filters to matching functions.
  test('the hub search filters by intent', async ({ page }) => {
    await page.getByRole('button', { name: 'Descobrir' }).click();
    await page.waitForURL('/descobrir');

    await page.getByRole('searchbox').fill('câmbio');
    // The browse header gives way to ranked results (at least one).
    await expect(page.getByText('Tudo que dá pra fazer')).toHaveCount(0);
    await expect(page.locator('.bg-surface-container button').first()).toBeVisible();
  });

  // D03/D04 — the single "Dividir" door opens the chooser with both options.
  test('FAB "Dividir" opens the bill-vs-group chooser and routes to a group', async ({ page }) => {
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    await page.getByText('Dividir', { exact: true }).click();

    await expect(page.getByText('Como você quer dividir?')).toBeVisible();
    await expect(page.getByText('Dividir uma conta')).toBeVisible();
    await expect(page.getByText('Divisão em grupo')).toBeVisible();

    await page.getByText('Divisão em grupo').click();
    // DEC-360: the group door now lands on the LIST (the discoverability fix),
    // which surfaces its own "+ Novo grupo" affordance — it no longer jumps
    // straight into an auto-opened create form (?new=1).
    await page.waitForURL(/\/groups$/);
    await expect(page.getByRole('button', { name: 'Novo grupo' })).toBeVisible();
  });
});
