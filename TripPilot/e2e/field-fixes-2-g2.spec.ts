import { test, expect, type Page } from '@playwright/test';

/**
 * Field Fixes & Clarity #2 — Gate 2 (E02 · DEC-322).
 * A fund linked to ANOTHER phase must stay selectable when logging an expense:
 * it appears in a labelled "Fundos de outras fases" group in the fund picker,
 * never auto-selected, never hidden.
 *
 * Demo (demo-data.ts): today is in "Burgos antes da eurotrip"; "Madrid" is a
 * later phase. The shipped operational pool ("Fundo Burgos + Madrid") is linked
 * to both, so a brand-new fund linked ONLY to Madrid is a clean off-phase case.
 */

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

const FUND_NAME = 'Fundo Madrid E2E';

async function createMadridOnlyFund(page: Page) {
  await page.goto('/funds');
  await page.getByRole('button', { name: /adicionar fundo/i }).click();
  // The form's first text input is the name; the first number input is the total.
  await page.locator('input[type="text"]').first().fill(FUND_NAME);
  await page.locator('input[type="number"]').first().fill('200');
  // Scope defaults to "Vinculado a fases" — link this fund to Madrid only.
  await page.getByRole('button', { name: 'Madrid', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  // The new fund now shows in the list.
  await expect(page.getByText(FUND_NAME).first()).toBeVisible();
}

test.describe('Field Fixes #2 G2 — off-phase funds are selectable', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('an expense can select a fund that belongs to another phase', async ({ page }) => {
    await createMadridOnlyFund(page);

    await page.goto('/quick-add');
    // Reveal the fund picker (the off-phase group lives inside the details block).
    await page.getByText(/^Detalhes$/).click();

    await expect(page.getByText(/fundos de outras fases/i)).toBeVisible();
    const offPhaseChip = page.getByRole('button', { name: FUND_NAME });
    await expect(offPhaseChip).toBeVisible();
    // It is selectable (tapping highlights it) — never blocked.
    await offPhaseChip.click();
  });

  test('income can also be registered into an off-phase fund', async ({ page }) => {
    await createMadridOnlyFund(page);

    await page.goto('/income');
    await expect(page.getByText(/fundos de outras fases/i)).toBeVisible();
    await expect(page.getByRole('button', { name: FUND_NAME })).toBeVisible();
  });
});
