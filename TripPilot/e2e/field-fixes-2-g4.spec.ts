import { test, expect } from '@playwright/test';

/**
 * Field Fixes & Clarity #2 — Gate 4 (home clarity).
 *  - E06 · DEC-326: the day check-in lives on the hero's "Posso gastar" row as a
 *    compact chip. With no intention chosen the picker is open; choosing one
 *    collapses the chip to a one-line summary that re-expands on tap (accordion).
 *  - E05 · DEC-325: a brand-new install shows an expanded labelled "Descobrir"
 *    CTA (and hides the empty bell) until the discovery hub is opened once, then
 *    the header reverts to the compact icon + bell.
 *  (E08 cofrinho-covered is a read-only render of the piggy ledger; its
 *   covered/overflow contract is locked by the piggy-ledger unit suite, not E2E,
 *   since a negative-day fixture is not deterministic in the demo data.)
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Field Fixes #2 G4 — compact check-in + first-run discover', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // E06 · DEC-326 — the check-in is a chip on the hero that expands/collapses.
  test('the day check-in sits on the hero and toggles expand/collapse', async ({ page }) => {
    // The chip's accessible name is the check-in title (aria-label wins over text).
    const checkInChip = page.getByRole('button', { name: /check-in do dia|day check-in|check-in del día/i });
    await expect(checkInChip).toBeVisible();

    // No intention yet → the picker is open on the hero. Pick "Tranquilo" (calm).
    const calmOption = page.getByRole('button', { name: /^tranquilo$|^easy$|^tranquilo $/i });
    await expect(calmOption).toBeVisible();
    await calmOption.click();

    // The chip now summarises the chosen intention on a single line.
    await expect(checkInChip).toContainText(/intenção de hoje|today's intention|intención de hoy/i);

    // Tapping the chip collapses the accordion (the picker leaves the DOM).
    await checkInChip.click();
    await expect(page.getByRole('button', { name: /^tranquilo$|^easy$/i })).toHaveCount(0);

    // Tapping again re-expands it.
    await checkInChip.click();
    await expect(page.getByRole('button', { name: /^tranquilo$|^easy$/i })).toBeVisible();
  });

  // E05 · DEC-325 — first-run shows the labelled CTA + hides the bell, then reverts.
  test('first run shows the labelled Descobrir CTA and reverts after opening the hub', async ({ page }) => {
    const cta = page.getByRole('button', { name: /descobrir o app|discover the app|descubrir la app/i });
    await expect(cta).toBeVisible();

    // The empty bell is hidden while the first-run nudge stands alone.
    await expect(
      page.getByRole('button', { name: /^notificações$|^notifications$|^notificaciones$/i }),
    ).toHaveCount(0);

    // Opening the hub retires the nudge for good.
    await cta.click();
    await page.waitForURL('/descobrir');
    await page.goBack();
    await page.waitForURL('/dashboard');

    // Reverted: the compact discover icon + bell are back; the CTA is gone.
    await expect(
      page.getByRole('button', { name: /^descobrir$|^discover$|^descubrir$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^notificações$|^notifications$|^notificaciones$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /descobrir o app|discover the app|descubrir la app/i }),
    ).toHaveCount(0);
  });
});
