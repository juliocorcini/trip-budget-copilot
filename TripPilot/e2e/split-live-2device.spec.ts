import { test, expect, type Page } from '@playwright/test';

/**
 * REAL two-device live table — the exact flow that failed on two phones:
 *   1. Owner (context A) builds a bill and starts the live table.
 *   2. Guest (context B, a SEPARATE context → no shared cache / SW / storage)
 *      opens the link, names themselves and taps an item.
 *   3. The owner MUST stop "waiting" and SEE the guest marking (the reported bug:
 *      the owner stayed on "esperando alguém entrar" forever).
 *   4. Two-way: the owner adds a second item and the GUEST must see it appear
 *      ("não atualiza nada de um celular no outro").
 *
 * Runs against whatever baseURL Playwright is pointed at: the dev server (sync
 * logic vs the real production worker) or the deployed site (PLAYWRIGHT_BASE_URL),
 * where the real Service Worker is engaged so the cache-fix path is exercised too.
 */

const SHOTS = 'test-results/live-2device';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

// On the deployed site the app registers a Service Worker; make sure it CONTROLS
// this page so the test exercises the real (post-fix) fetch path — the cross-
// origin live-share polls must reach the network, not a stale SW cache. No-op on
// the dev server (Vite does not register the production SW).
async function engageServiceWorker(page: Page): Promise<void> {
  const hasReg = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      return !!(await navigator.serviceWorker.getRegistration());
    } catch {
      return false;
    }
  });
  if (!hasReg) return;
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  }
}

// Surface page crashes / failed share requests so a regression points straight
// at the cause instead of a generic timeout, and count how many live-share GETs
// actually leave the browser (the old SW bug swallowed them into the cache).
function wireLogs(page: Page, tag: string, counters: { gets: number }): void {
  page.on('pageerror', (e) => console.log(`[${tag} pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    if (r.url().includes('/share')) {
      console.log(`[${tag} reqfail] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`);
    }
  });
  page.on('request', (r) => {
    if (r.method() === 'GET' && /\/share\/[^/]+\/responses/.test(r.url())) counters.gets += 1;
  });
}

// The add affordance differs by screen: the empty capture screen offers
// "Adicionar manualmente"; the divide board offers "Adicionar item".
async function addItem(owner: Page, trigger: RegExp, name: string, price: string): Promise<void> {
  await owner.getByRole('button', { name: trigger }).click();
  const editor = owner.getByRole('dialog', { name: 'Editar item' });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.locator('input').first().fill(name);
  await editor.locator('input[type="number"]').fill(price);
  await editor.getByRole('button', { name: 'Pronto' }).click();
  await expect(editor).toBeHidden();
}

test.describe('Bill split — live table TWO devices (real)', () => {
  test.describe.configure({ timeout: 150_000 });

  test('owner sees the guest join + claim, and the guest sees the owner add an item', async ({ browser }) => {
    const ownerGets = { gets: 0 };
    const guestGets = { gets: 0 };

    // ---- Owner (device A) ----
    const ownerCtx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const owner = await ownerCtx.newPage();
    wireLogs(owner, 'OWNER', ownerGets);

    await loadDemo(owner);
    await engageServiceWorker(owner);
    await owner.goto('/split/scan');
    await expect(owner.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();

    await addItem(owner, /Adicionar manualmente/, 'Pizza', '60');

    // Start the live table (idle invite card "Mesa ao vivo" → publishes).
    await owner.getByText('Mesa ao vivo').first().click();

    // Once live, a "Compartilhar link" button opens the share sheet (QR + copy +
    // native share). This replaced the old button that silently copied.
    const shareBtn = owner.getByRole('button', { name: 'Compartilhar link' });
    await expect(shareBtn).toBeVisible({ timeout: 20_000 });
    await shareBtn.click();

    const sheet = owner.getByRole('dialog', { name: 'Compartilhar a mesa' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    // The QR is rendered for phones that are physically together.
    await expect(sheet.locator('img, canvas, svg').first()).toBeVisible({ timeout: 10_000 });
    await sheet.getByRole('button', { name: 'Copiar link' }).click();
    const link = await owner.evaluate(() => navigator.clipboard.readText());
    console.log('[TEST] live link =', link);
    expect(link).toContain('/t/');
    await owner.screenshot({ path: `${SHOTS}/01-owner-share-sheet.png` });

    await owner.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    // The owner starts in the "waiting" state — the exact bug was being stuck here.
    await expect(owner.getByText('Esperando alguém entrar…')).toBeVisible({ timeout: 10_000 });

    // ---- Guest (device B): a SEPARATE context — no shared cache / SW / storage ----
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    wireLogs(guest, 'GUEST', guestGets);

    const u = new URL(link);
    await guest.goto(u.pathname + u.search + u.hash);
    await engageServiceWorker(guest);

    const nameInput = guest.getByPlaceholder('Seu nome');
    await expect(nameInput).toBeVisible({ timeout: 20_000 });
    await nameInput.fill('Ana');
    await guest.getByRole('button', { name: 'Entrar na mesa' }).click();

    // Guest sees the bill and taps their item.
    const pizza = guest.getByText('Pizza');
    await expect(pizza).toBeVisible({ timeout: 20_000 });
    await pizza.click();

    // Guest's own total ("Sua parte") reflects the 60.00 pizza.
    await expect(
      guest.locator('span.text-xl.font-extrabold').filter({ hasText: /60[.,]00/ }),
    ).toBeVisible({ timeout: 15_000 });
    await guest.screenshot({ path: `${SHOTS}/02-guest-claimed.png` });

    // ---- Owner MUST see the guest (was stuck on "waiting") ----
    await expect(owner.getByText(/marcando agora/)).toBeVisible({ timeout: 30_000 });
    console.log('[TEST] OWNER now shows a guest marking.');
    await owner.screenshot({ path: `${SHOTS}/03-owner-sees-guest.png` });

    // ---- Two-way: owner adds a second item → the GUEST must see it appear ----
    await addItem(owner, /Adicionar item/, 'Refrigerante', '12');
    await expect(guest.getByText('Refrigerante')).toBeVisible({ timeout: 30_000 });
    console.log('[TEST] GUEST now sees the owner-added item.');
    await guest.screenshot({ path: `${SHOTS}/04-guest-sees-owner-edit.png` });

    console.log(`[TEST] live-share GETs that left the browser → owner=${ownerGets.gets} guest=${guestGets.gets}`);
    // The old SW bug swallowed every poll after the first into the cache. With the
    // fix each poll reaches the network, so the owner has issued several.
    expect(ownerGets.gets).toBeGreaterThan(1);

    // Cleanup + revoke path: ending the table tombstones it on the server (so a
    // production run leaves no live data behind) and the guest's link goes dead.
    await owner.getByRole('button', { name: 'Encerrar' }).click();
    await expect(owner.getByText('Mesa ao vivo').first()).toBeVisible({ timeout: 10_000 });

    await ownerCtx.close();
    await guestCtx.close();
  });
});
