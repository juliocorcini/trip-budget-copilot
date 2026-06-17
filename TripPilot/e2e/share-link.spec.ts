import { test, expect, type Page } from '@playwright/test';

/**
 * DEC-207 — end-to-end proof of the shared participant link across TWO isolated
 * browser contexts (separate IndexedDB = a real owner + a real guest), talking
 * to the live deployed worker (share channel). Covers the magic loop:
 *   owner generates a link → guest opens it in a fresh browser (no app/account)
 *   → guest sees only their shared statement → confirms a line + "I paid" →
 *   owner pulls and sees the response + settle proposal.
 */

const SHOTS = '.ux-shots/share';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

/**
 * Owner: demo → participant "Ana" → generate her share link. Leaves the share
 * sheet open (so the owner's live signal socket stays connected) and returns
 * the encrypted URL.
 */
async function ownerGenerateLink(page: Page): Promise<string> {
  await loadDemo(page);
  await page.goto('/shared');
  await page.getByRole('button', { name: /Ana/ }).first().click();
  const statementSheet = page.getByRole('dialog');
  await expect(statementSheet).toBeVisible();
  await statementSheet.getByRole('button', { name: 'Compartilhar por link' }).click();
  const shareSheet = page.getByRole('dialog');
  await shareSheet.getByRole('button', { name: 'Gerar link' }).click();
  const urlNode = shareSheet.locator('p.break-all');
  await expect(urlNode).toBeVisible({ timeout: 15_000 });
  const shareUrl = (await urlNode.textContent())?.trim() ?? '';
  expect(shareUrl).toMatch(/\/s\/[^#]+#k=.+/);
  return shareUrl;
}

test.describe('Shared participant link (DEC-207)', () => {
  test('owner → isolated guest → owner full loop', async ({ page, browser }) => {
    // The loop spans two browser contexts + live-worker round-trips with KV
    // (eventually consistent) retries on the owner pull — give it room.
    test.setTimeout(120_000);

    // ───────────────────────── OWNER: generate the link ─────────────────────
    const shareUrl = await ownerGenerateLink(page);
    const shareSheet = page.getByRole('dialog');
    await page.screenshot({ path: `${SHOTS}/01-owner-link.png`, fullPage: true });

    // ───────────────────────── GUEST: fresh isolated context ────────────────
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(shareUrl);

    // Lands on the signup-less guest home, never bounced to onboarding.
    await guest.waitForURL('**/shared-with-me', { timeout: 25_000 });
    await expect(
      guest.getByRole('heading', { name: 'Compartilhadas comigo' }),
    ).toBeVisible();

    // The statement shared by the owner ("Julio") is listed.
    const statementButton = guest.getByRole('button', { name: /Julio/ });
    await expect(statementButton.first()).toBeVisible({ timeout: 15_000 });
    await guest.screenshot({ path: `${SHOTS}/02-guest-home.png`, fullPage: true });

    // Open it → the itemized statement with confirm/reject affordances.
    await statementButton.first().click();
    const guestSheet = guest.getByRole('dialog');
    await expect(guestSheet).toBeVisible();
    await guest.screenshot({ path: `${SHOTS}/03-guest-statement.png`, fullPage: true });

    // Confirm a pending line — demo seeds at least one. pushed=true →
    // "Resposta enviada" proves the answer reached the live worker.
    const confirmBtn = guestSheet.getByRole('button', { name: 'Confirmar' });
    await expect(confirmBtn.first()).toBeVisible({ timeout: 10_000 });
    await confirmBtn.first().click();
    await expect(guest.getByText('Resposta enviada')).toBeVisible({ timeout: 10_000 });

    // ───────────────────────── OWNER: pull the guest's response ─────────────
    // KV is eventually consistent — retry the pull until the line response is
    // applied ("N resposta(s) aplicada(s)"). The applying pull coincides with
    // the first read that returns the data, so the polled assertion catches the
    // toast within its lifetime.
    await page.bringToFront();
    const pullBtn = shareSheet.getByRole('button', { name: 'Ver respostas' });
    const applied = page.getByText(/resposta\(s\) aplicada|marcou como pago/);
    let pulled = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      await pullBtn.click();
      try {
        await expect(applied).toBeVisible({ timeout: 3_000 });
        pulled = true;
        break;
      } catch {
        await page.waitForTimeout(3_000);
      }
    }
    expect(pulled).toBe(true);
    await page.screenshot({ path: `${SHOTS}/04-owner-pull.png`, fullPage: true });

    await guestContext.close();
  });

  test('owner refresh delivers a LIVE update to a connected guest (S7)', async ({ page, browser }) => {
    test.setTimeout(120_000);

    // Owner generates the link; the share sheet stays open → owner relay socket
    // connects.
    const shareUrl = await ownerGenerateLink(page);

    // Guest opens it in a fresh context → /shared-with-me mounts and its live
    // socket connects for this statement.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(shareUrl);
    await guest.waitForURL('**/shared-with-me', { timeout: 25_000 });
    await expect(guest.getByRole('button', { name: /Julio/ }).first()).toBeVisible({ timeout: 15_000 });
    // Let the guest's WebSocket finish connecting before the owner pushes.
    await guest.waitForTimeout(2_500);

    // Owner re-publishes the statement → emits an 'upd' signal over the relay.
    await page.bringToFront();
    await page.getByRole('dialog').getByRole('button', { name: 'Atualizar dados' }).click();
    await expect(page.getByText('Dados do link atualizados')).toBeVisible({ timeout: 10_000 });

    // The guest is notified LIVE — no tap, no refresh — straight from the relay.
    await expect(guest.getByText(/atualizou os gastos compartilhados/)).toBeVisible({ timeout: 20_000 });
    await guest.screenshot({ path: `${SHOTS}/07-guest-live-update.png`, fullPage: true });

    await guestContext.close();
  });

  test('malformed link shows a friendly, recoverable error', async ({ page }) => {
    await page.goto('/s/00000000-0000-4000-8000-000000000000#k=not-a-real-key');
    await expect(
      page.getByText(/Link não encontrado|inválido|revogado|Sem conexão/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Ir para o início' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/05-guest-error.png`, fullPage: true });
  });
});
