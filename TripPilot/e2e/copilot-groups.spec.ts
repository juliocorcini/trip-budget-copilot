import { test, expect } from '@playwright/test';

// PACOTE #3 (UX audit §4.6) — anti-regression for the Copiloto redesign:
// the ~18 reads used to be a flat wall; they're now grouped into four themes
// (Agora / Para onde vai / Padrões / Pessoas). The first non-empty group opens
// by default, the others are one tap away, and an empty group never renders.

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('PACOTE #3 — Copiloto theme groups', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
    await page.goto('/copiloto');
  });

  test('first group opens by default; the others collapse their content', async ({ page }) => {
    // "Agora" is the first non-empty theme — its header shows and its content
    // (the verdict / honest-friend reads) is expanded without any tap.
    await expect(page.getByRole('button', { name: /agora|^now\b/i })).toBeVisible();

    // "Padrões" is collapsed at rest: its inner reads are not in the DOM until
    // the header is tapped (the group renders children only when open).
    await expect(page.getByText('De onde veio')).toHaveCount(0);
    await page.getByRole('button', { name: /padrões|patterns/i }).click();
    await expect(page.getByText('De onde veio')).toBeVisible();
  });

  test('every rendered group is collapsible (header toggles its content)', async ({ page }) => {
    // Open "Pessoas" and confirm a read inside it appears, then collapse it again.
    const peopleHeader = page.getByRole('button', { name: /pessoas|people/i });
    await peopleHeader.click();
    await expect(page.getByText('Social × solo')).toBeVisible();
    await peopleHeader.click();
    await expect(page.getByText('Social × solo')).toHaveCount(0);
  });

  test('tools footer survives the regrouping', async ({ page }) => {
    // The always-on tools grid (Impacto / Simular / Resgate / Guia) stays put
    // below the themed groups.
    await expect(page.getByText(/resgate|rescue/i).first()).toBeVisible();
  });
});
