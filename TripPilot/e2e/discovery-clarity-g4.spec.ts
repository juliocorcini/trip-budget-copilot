import { test, expect } from '@playwright/test';

/**
 * Discovery & Clarity — Gate 4 (money clarity).
 *  - D11/D14 · DEC-313/314: the day's saving has ONE destination, never two —
 *    the cofrinho when active OR the next days, never both at once.
 *  - D13 · DEC-312: the hero "De onde vem?" sheet also explains the DAY's money
 *    (how the daily slice moves / where a calm day's saving goes).
 *  - D10 · DEC-316: "posso gastar" stays reachable as a compact chip.
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Discovery & Clarity G4 — money clarity', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  // D11/D14 · DEC-313/314 — single saving destination, no double-count.
  test('a "no spend" check-in shows exactly one saving destination', async ({ page }) => {
    await page.getByRole('button', { name: /sem gastos|no spend|sin gastos/i }).click();

    // The "where today's saving goes" block renders exactly once.
    const dest = page.locator('[data-saving-destination]');
    await expect(dest).toHaveCount(1);

    // Inside it: the cofrinho XOR the next days — never both (the old bug showed
    // "+X/day on the next days" AND "the piggy below" simultaneously).
    const piggy = dest.getByText(/cofrinho|piggy bank|alcancía/i);
    const nextDays = dest.getByText(/próximos dias|next days|próximos días/i);
    const both = (await piggy.count()) > 0 && (await nextDays.count()) > 0;
    expect(both).toBe(false);
  });

  // D13 · DEC-312 — the hero breakdown explains the day's money too.
  test('the hero "where it comes from" sheet explains the daily money', async ({ page }) => {
    await page
      .getByRole('button', { name: /de onde vem|where this number|de dónde/i })
      .click();
    await expect(
      page.getByText(
        /como funciona o dinheiro do dia|how the daily money works|cómo funciona el dinero del día/i,
      ),
    ).toBeVisible();
  });

  // D10 · DEC-316 — "posso gastar" stays reachable (compact) and primes the simulator.
  test('the compact "can I spend" chip opens the simulator', async ({ page }) => {
    await page
      .getByRole('button', { name: /posso gastar|can i spend|puedo gastar/i })
      .click();
    await page.waitForURL(/\/simulator/);
  });
});
