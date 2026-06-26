import { test, expect, type Page } from '@playwright/test';

/**
 * Grupos, Sincronia & Nuvem — G4 (1.2.3-rc): everyone contributes (DEC-340,
 * owner-as-reducer). A no-app web guest on the public `/g/` board authors an
 * expense; it shows "pending" on their side, then folds into the owner's live
 * event (and back to the guest as no-longer-pending) once the owner polls.
 *
 * Real two-context flow against whatever baseURL Playwright targets (dev server
 * or the deployed site), exactly like the bill-split live two-device test — the
 * encrypted share channel + reducer are the same plumbing.
 */

const SHOTS = 'test-results/groups-g4';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Groups wave G4 — everyone contributes', () => {
  test.describe.configure({ timeout: 150_000 });

  test('a /g/ guest authors an expense that folds into everyone (pending → live)', async ({ browser }) => {
    // ---- Owner (device A): create a group with one other person, then invite ----
    const ownerCtx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const owner = await ownerCtx.newPage();

    await loadDemo(owner);
    await owner.goto('/groups');
    const newBtn = owner.getByRole('button', { name: /novo grupo|new group/i });
    if (await newBtn.isVisible().catch(() => false)) await newBtn.click();

    await owner.getByRole('textbox').first().fill('G4 Live');
    const personInput = owner.getByPlaceholder(/nome da pessoa|person's name|nombre de la persona/i);
    await personInput.fill('Bruno');
    await owner.getByRole('button', { name: /^adicionar$|^add$/i }).click();
    await owner.getByRole('button', { name: /^criar$|^create$/i }).click();
    await owner.waitForURL(/\/groups\/[^/]+$/);
    await expect(owner.getByText('Bruno')).toBeVisible();

    // Publish the public board → the invite copies the `/g/` link.
    await owner.getByRole('button', { name: /convidar o grupo|invite the group|invitar al grupo/i }).click();
    // The live link is shown on the page once shared; read it from there (robust to
    // headless clipboard quirks) and fall back to the clipboard if needed.
    const linkLocator = owner.locator('p', { hasText: '/g/' }).first();
    await expect(linkLocator).toBeVisible({ timeout: 20_000 });
    let link = (await linkLocator.textContent())?.trim() ?? '';
    if (!/\/g\//.test(link)) link = await owner.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('/g/');
    await owner.screenshot({ path: `${SHOTS}/01-owner-published.png` });

    // ---- Guest (device B): a SEPARATE context — no shared storage ----
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    const u = new URL(link);
    await guest.goto(u.pathname + u.search + u.hash);

    // Pick my name (the non-owner slot), which unlocks contributing.
    await guest.getByRole('button', { name: /Bruno/ }).click();
    const addBtn = guest.getByRole('button', { name: /^adicionar despesa$|^add expense$|^añadir gasto$/i });
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await addBtn.click();

    await guest.getByPlaceholder(/descrição|description|descripción/i).fill('Taxi G4');
    await guest.locator('input[type="number"]').fill('30');
    await guest.getByRole('button', { name: /^adicionar$|^add$|^añadir$/i }).click();

    // It shows immediately on my side, marked pending until the owner folds it.
    await expect(guest.getByText('Taxi G4')).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByText(/pendente|pending|pendiente/i)).toBeVisible({ timeout: 10_000 });
    await guest.screenshot({ path: `${SHOTS}/02-guest-pending.png` });

    // ---- Owner MUST fold the guest-authored expense into the live event ----
    await expect(owner.getByText('Taxi G4')).toBeVisible({ timeout: 40_000 });
    await owner.screenshot({ path: `${SHOTS}/03-owner-folded.png` });

    // ---- And it comes back to the guest as no-longer-pending (honest sync) ----
    await expect(guest.getByText(/pendente|pending|pendiente/i)).toBeHidden({ timeout: 40_000 });
    await expect(guest.getByText('Taxi G4')).toBeVisible();
    await guest.screenshot({ path: `${SHOTS}/04-guest-synced.png` });

    await ownerCtx.close();
    await guestCtx.close();
  });
});
