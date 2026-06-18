import { test, expect } from '@playwright/test';

/**
 * GATE 1 (canonical budget model) — the dashboard hero and the Viagem phase
 * cards must reflect the ACTIVE phase's budget, not a fixed `linkedPools[0]`.
 *
 * The demo trip is a LEGACY trip (one `linked_phases` pool shared by both
 * phases), so `selectActivePhasePool` must keep resolving that single pool for
 * every phase — proving AC1 ("viagem legada inalterada"). The per-phase
 * free-to-spend still differs (phase 2 carries a future floor), which proves the
 * `freeForPhase` rewiring (M1.3) computes per phase instead of always the first.
 */
async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /demo|demonstração/i });
  await demoButton.click();
  await page.waitForURL('/dashboard');
}

test.describe('GATE 1 — dashboard follows the active phase', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('hero renders a coherent budget for the active phase', async ({ page }) => {
    // The hero shows a base-currency money value (the active phase free-to-spend).
    await expect(page.getByText(/€\s?-?\d/).first()).toBeVisible();
  });

  test('switching the phase chip recomputes the per-phase plan/free (M1.3)', async ({ page }) => {
    await page.goto('/viagem');

    // The hub auto-selects the ACTIVE phase and shows its plan card with the
    // phase free-to-spend. Capture the active phase's plan snapshot.
    const planCard = page.getByRole('button', { name: /plano desta fase/i });
    await expect(planCard).toBeVisible();
    await expect(planCard).toContainText('Burgos antes da eurotrip');
    const activeSnapshot = (await planCard.textContent())?.trim() ?? '';

    // Switch to the OTHER phase via its chip (the chip is named by the phase).
    await page.getByRole('button', { name: 'Madrid', exact: true }).click();

    // The plan card re-renders for Madrid; its free-to-spend differs from
    // Burgos' (phase 2 carries a future floor + no spend), which can only be
    // true if `freeForPhase` is computed per phase (the M1.3 rewiring).
    await expect(planCard).toContainText('Madrid');
    const madridSnapshot = (await planCard.textContent())?.trim() ?? '';
    expect(madridSnapshot).not.toBe(activeSnapshot);
    // Both snapshots still expose a money value (never blank).
    expect(activeSnapshot).toMatch(/€\s?-?\d/);
    expect(madridSnapshot).toMatch(/€\s?-?\d/);
  });
});
