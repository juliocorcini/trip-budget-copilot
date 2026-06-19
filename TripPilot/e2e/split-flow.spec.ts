import { test, expect, type Page } from '@playwright/test';

/**
 * Bill split (G1) — proves the "Dividir conta" surface end-to-end on the front:
 * the FAB star opens it, the manual capture path drops straight into the divide
 * board, the mode fork + service-charge sheet are wired, and committing writes a
 * single expense (success toast → expense list). The math itself is covered by
 * the domain/orchestrator unit suites; this guards the wiring + copy.
 */

const SHOTS = '.ux-shots/split';

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Bill split — Dividir conta (G1)', () => {
  // The golden path is a long multi-step flow (demo seed + capture + claim + tax
  // + commit); give it headroom so it never times out under full-suite parallel load.
  test.describe.configure({ timeout: 90_000 });

  test('the FAB star opens the split bill flow', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: 'Ações rápidas' }).click();
    await page.getByRole('button', { name: /Dividir conta/ }).click();
    await page.waitForURL('**/split/scan', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();
  });

  test('manual capture → item → mode fork → service charge → commit', async ({ page }) => {
    await loadDemo(page);
    await page.goto('/split/scan');
    await expect(page.getByRole('heading', { name: 'Dividir conta' })).toBeVisible();

    // Manual capture path (no OCR / cloud consent needed).
    await page.getByRole('button', { name: /Adicionar manualmente/ }).click();

    // The item editor opens on the first (empty) line.
    const editor = page.getByRole('dialog', { name: 'Editar item' });
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.locator('input').first().fill('Pizza');
    await editor.locator('input[type="number"]').fill('60');
    await editor.getByRole('button', { name: 'Pronto' }).click();
    await expect(editor).toBeHidden();

    // Divide phase: the item, the owner's slice (the "O que é meu" hero), and the
    // commit CTA are present.
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('O que é meu')).toBeVisible();

    // The mode fork is interactive (equal → back to itemized).
    await page.getByRole('button', { name: 'Igual', exact: true }).click();
    await page.getByRole('button', { name: 'Cada um o seu', exact: true }).click();

    // Pass-the-phone: the owner is the active tapper, so tapping the line claims
    // it for them (the orphan warning disappears).
    await page.getByText('Pizza').click();

    // Service charge: 10% via the tax sheet → 60,00 + 6,00 = 66,00.
    await page.getByText('Taxa de serviço', { exact: true }).first().click();
    const taxSheet = page.getByRole('dialog', { name: 'Taxa de serviço' });
    await expect(taxSheet).toBeVisible();
    await taxSheet.locator('input[type="number"]').fill('10');
    await taxSheet.getByRole('button', { name: 'Confirmar' }).click();
    await expect(taxSheet).toBeHidden();

    await page.screenshot({ path: `${SHOTS}/01-divide.png`, fullPage: true });

    // The CTA tells the truth: the whole bill is logged (60 + 10% service).
    const commit = page.getByRole('button', { name: /Registrar.*66,00/ });
    await expect(commit).toBeVisible();

    // Commit → success toast + lands on the expense list.
    await commit.click();
    await expect(page.getByText('Conta dividida e registrada')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL('**/expenses', { timeout: 10_000 });
  });
});
