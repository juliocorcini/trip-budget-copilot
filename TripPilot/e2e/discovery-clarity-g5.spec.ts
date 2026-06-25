import { test, expect, type Page } from '@playwright/test';

/**
 * Discovery & Clarity — Gate 5 (phase-scoped pots, D15 · DEC-314/315).
 *  - D15c: the create door explicitly separates an Event (a date → a countdown)
 *    from a Pote/Fundo (no date → no countdown, takes spend at any time).
 *  - D15a: a pot dated for another phase does NOT pollute the current phase's
 *    focus on the Home — it lives in a collapsed "Potes de outras fases" area.
 *  - D15b: that same off-phase pot stays selectable as a fund when planning a spend.
 *
 * Demo timeline (demo-data.ts): today sits in phase 1 (Burgos); phase 2 (Madrid)
 * starts at +11 days. A pot dated +30 days therefore belongs to another phase.
 */

const KIND_SPEND = /gasto ou evento|spend or event|gasto o evento/i;
const KIND_FUND = /pote ou fundo|pot or fund|sobre o fondo/i;
const FUND_SCOPE_Q = /para qual parte da viagem|which part of the trip|para qué parte del viaje/i;
const Q1_YES = /sim, tem data|yes, it has a date|sí, tiene fecha/i;
const Q1_NO = /não tem data|no date|sin fecha/i;
const FUNDING_NEW_POT = /valor à parte|separate amount|importe aparte/i;
const PLAN_CREATE = /^(Planejar|Plan|Planear)$/;
const PLAN_SAVE = /salvar como planejado|save as planned|guardar como planeado/i;
const NO_COUNTDOWN = /sem contagem|no countdown|sin cuenta/i;

const POT_NAME = 'Festival Madrid';

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

/** Opens the single "Planejar um gasto" door from the simulator verdict CTAs. */
async function openPlanDoor(page: Page) {
  await page.goto('/simulator');
  await page.locator('input[type="number"]').first().fill('30');
  await page.getByRole('button', { name: PLAN_SAVE }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('Discovery & Clarity G5 — phase-scoped pots', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // D15c · DEC-315 / E01 · DEC-321 — the door's first fork is the INTENT: a
  // spend/event (a date → a countdown) vs a pote/fundo (no date → no countdown).
  test('the create door separates a spend/event from a pote/fundo (no countdown)', async ({
    page,
  }) => {
    await openPlanDoor(page);
    const sheet = page.getByRole('dialog');

    // Choosing "a pote/fundo" → the note states there is NO countdown, no date field,
    // and it asks which part of the trip the money belongs to (phase × whole trip).
    await sheet.getByRole('button', { name: KIND_FUND }).click();
    await expect(sheet.locator('[data-plan-kind-note]')).toHaveText(NO_COUNTDOWN);
    await expect(sheet.locator('input[type="date"]')).toHaveCount(0);
    await expect(sheet.getByText(FUND_SCOPE_Q)).toBeVisible();

    // Choosing "a spend/event" + "has a date" reveals the date field (the Event branch).
    await sheet.getByRole('button', { name: KIND_SPEND }).click();
    await sheet.getByRole('button', { name: Q1_YES }).click();
    await expect(sheet.locator('input[type="date"]').first()).toBeVisible();

    // Back to "no date" within the spend branch hides the date field again.
    await sheet.getByRole('button', { name: Q1_NO }).click();
    await expect(sheet.locator('input[type="date"]')).toHaveCount(0);
  });

  // D15a/D15b — a future-phase pot stays out of the Home focus but reachable + selectable.
  test('a future-phase pot is hidden from the Home focus, collapsed, yet still selectable', async ({
    page,
  }) => {
    // 1) Create a dated pot for a later phase (+30 days) funded by a new pot.
    await openPlanDoor(page);
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: Q1_YES }).click();
    await sheet.locator('input[type="date"]').first().fill(inDays(30));
    await sheet.getByRole('button', { name: FUNDING_NEW_POT }).click();
    await sheet.locator('input[type="text"]').first().fill(POT_NAME);
    await sheet.getByRole('button', { name: PLAN_CREATE }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 2) On the Home it must NOT be in focus — it sits inside the collapsed area.
    await page.goto('/dashboard');
    const otherPhases = page.locator('[data-other-phase-pots]');
    await expect(otherPhases).toBeVisible();
    // Collapsed by default: the pot name is not shown until the section is opened.
    await expect(page.getByText(POT_NAME)).toHaveCount(0);
    await otherPhases.getByRole('button').first().click();
    await expect(otherPhases.getByText(POT_NAME)).toBeVisible();

    // 3) It stays selectable as a fund when planning a spend (DEC-314 — selectable).
    await openPlanDoor(page);
    const sheet2 = page.getByRole('dialog');
    await sheet2
      .getByRole('button', { name: /pote que já existe|pot you already have|fondo que ya existe/i })
      .click();
    await expect(sheet2.locator('select option', { hasText: POT_NAME })).toHaveCount(1);
  });
});
