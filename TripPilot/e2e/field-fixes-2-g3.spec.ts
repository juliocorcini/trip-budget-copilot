import { test, expect, type Page } from '@playwright/test';

/**
 * Field Fixes & Clarity #2 — Gate 3 (E01 · DEC-321).
 * The "Planejar um gasto" door's first fork is the INTENT. Choosing "a pote/fundo"
 * for a specific (future) phase must create a phase-scoped fund — NOT a dated Event:
 *  - no countdown / event card pollutes the current phase's Home;
 *  - the fund is reachable + selectable when logging a spend (the off-phase group).
 *
 * Demo (demo-data.ts): today is in "Burgos antes da eurotrip"; "Madrid" is a later
 * phase. A fund scoped to Madrid is therefore a clean off-phase case on today's Home.
 */

const KIND_FUND = /pote ou fundo|pot or fund|sobre o fondo/i;
const FUND_SCOPE_PHASE = /uma fase específica|a specific phase|una fase específica/i;
const PLAN_CREATE = /^(Planejar|Plan|Planear)$/;
const PLAN_SAVE = /salvar como planejado|save as planned|guardar como planeado/i;

const FUND_NAME = 'Reserva Madrid E2E';

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

/** Opens the single "Planejar um gasto" door from the simulator verdict CTAs. */
async function openPlanDoor(page: Page) {
  await page.goto('/simulator');
  await page.locator('input[type="number"]').first().fill('40');
  await page.getByRole('button', { name: PLAN_SAVE }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('Field Fixes #2 G3 — fund for a future phase, never an Event', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('a phase-scoped fund is created without an event and stays usable', async ({ page }) => {
    // 1) Plan door → "a pote/fundo" → "a specific phase" → Madrid (a later phase).
    await openPlanDoor(page);
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: KIND_FUND }).click();
    await sheet.getByRole('button', { name: FUND_SCOPE_PHASE }).click();
    await sheet.locator('select').first().selectOption({ label: 'Madrid' });
    await sheet.locator('input[type="text"]').first().fill(FUND_NAME);
    await sheet.locator('input[type="number"]').first().fill('300');
    await sheet.getByRole('button', { name: PLAN_CREATE }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 2) No Event was created: the fund does not pollute the current phase's Home
    //    focus (no countdown card). It rests in the collapsed off-phase pots area.
    await page.goto('/dashboard');
    await expect(page.getByText(FUND_NAME)).toHaveCount(0);

    // 3) It is selectable when logging a spend — the exact journey that was broken.
    await page.goto('/quick-add');
    await page.getByText(/^Detalhes$/).click();
    await expect(page.getByText(/fundos de outras fases/i)).toBeVisible();
    const offPhaseChip = page.getByRole('button', { name: FUND_NAME });
    await expect(offPhaseChip).toBeVisible();
    await offPhaseChip.click();
  });
});
