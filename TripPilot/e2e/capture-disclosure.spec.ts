import { test, expect } from '@playwright/test';

// PACOTE #2 (UX audit §3 + §4.3) — anti-regression for the capture redesign:
// the FAB keeps all 9 actions with the heroes at the base + expanders, and the
// Quick Add collapses everything but amount/category/description under "Detalhes".

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('PACOTE #2 — capture progressive disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('FAB (GATE 18): heroes at the base, planning visible, "mercado" demoted into "Outros registros" (nothing removed)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /ações rápidas|quick actions/i }).click();

    // Heroes are always visible — the thumb-zone base of the sheet.
    await expect(page.getByText(/registrar gasto|register expense/i).first()).toBeVisible();
    await expect(page.getByText(/escanear nota|scan receipt/i).first()).toBeVisible();

    // GATE 18: the planning tools now lead the visible tier (no "Planejar"
    // expander) — reachable in one tap, not buried.
    await expect(page.getByText('Planejar um gasto', { exact: true })).toBeVisible();
    await expect(page.getByText('Simular compra', { exact: true })).toBeVisible();
    await expect(page.getByText('Começar saída', { exact: true })).toBeVisible();

    // GATE 18: "Registrar mercado" was demoted — no longer a prime chip; it lives
    // inside the collapsed "Outros registros" (not in the DOM until it opens).
    await expect(page.getByText('Registrar mercado', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Registrar transferência')).toHaveCount(0);
    await page.getByRole('button', { name: /outros registros|other entries/i }).click();
    await expect(page.getByText('Registrar mercado', { exact: true })).toBeVisible();
    await expect(page.getByText('Registrar transferência')).toBeVisible();
    await expect(page.getByText('Registrar saque')).toBeVisible();
  });

  test('Quick Add: only amount/category/description by default; the rest collapses under "Detalhes"', async ({
    page,
  }) => {
    await page.goto('/quick-add');

    // The essentials are always visible.
    await expect(page.getByText('Valor')).toBeVisible();
    await expect(page.getByText('Categoria')).toBeVisible();
    await expect(page.getByText('Descrição')).toBeVisible();

    // The advanced fields are hidden behind "Detalhes" at rest (a ~3-tap expense).
    await expect(page.getByText('Data e hora (opcional)')).toHaveCount(0);
    await page.getByRole('button', { name: /detalhes|details/i }).click();
    await expect(page.getByText('Data e hora (opcional)')).toBeVisible();
    await expect(page.getByText('Fotos')).toBeVisible();
  });
});
