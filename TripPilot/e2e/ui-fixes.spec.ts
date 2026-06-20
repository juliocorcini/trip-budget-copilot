import { test, expect, type Page } from '@playwright/test';

/**
 * v0.99.8 — regression guards + visual proof for the reported UI bugs:
 *  - D-BUG-21: native scrollbars came back on every screen (must stay hidden).
 *  - D-BUG-23: the expense multi-select action bar hid extra options off-screen.
 * (D-BUG-22 — calendar currency symbol — is guarded by the HeatmapGrid component
 *  test + the money unit suite, which are deterministic; the heatmap only renders
 *  for months that have spending, so an E2E on demo data is unreliable.)
 */

async function loadDemoData(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

/** Any element whose box reserves space for a native (gutter-taking) scrollbar. */
async function scrollbarOffenders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const docGutter = window.innerWidth - document.documentElement.clientWidth;
    if (docGutter > 1) bad.push(`document v=${docGutter}`);
    document.querySelectorAll('*').forEach((el) => {
      const e = el as HTMLElement;
      const style = getComputedStyle(e);
      if (!/(auto|scroll)/.test(style.overflowY + style.overflowX)) return;
      const borderX =
        parseFloat(style.borderLeftWidth || '0') + parseFloat(style.borderRightWidth || '0');
      const borderY =
        parseFloat(style.borderTopWidth || '0') + parseFloat(style.borderBottomWidth || '0');
      const vGutter = e.offsetWidth - e.clientWidth - borderX;
      const hGutter = e.offsetHeight - e.clientHeight - borderY;
      if (vGutter > 1 || hGutter > 1) {
        bad.push(`${e.tagName}.${String(e.className).slice(0, 40)} v=${vGutter} h=${hGutter}`);
      }
    });
    return bad;
  });
}

// Only meaningful in a desktop context, where Chromium paints a classic,
// space-taking scrollbar if our CSS did not hide it (mobile emulation forces
// overlay bars that never take a gutter).
test.describe('D-BUG-21 — no native scrollbar on any screen', () => {
  test.use({ viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false });
  test.slow();

  for (const route of ['/dashboard', '/expenses', '/shared', '/settings', '/copiloto']) {
    test(`no gutter-taking scrollbar on ${route}`, async ({ page }) => {
      await loadDemoData(page);
      await page.goto(route);
      await page.waitForTimeout(500);
      const offenders = await scrollbarOffenders(page);
      await page.screenshot({
        path: `test-results/ui-fixes/scrollbar${route.replace(/\//g, '_')}.png`,
      });
      expect(offenders, `scrollbar offenders on ${route}`).toEqual([]);
    });
  }
});

test.describe('D-BUG-23 — expense multi-select bar shows every action', () => {
  test('long-press opens the bar with all actions fully on-screen', async ({ page }) => {
    await loadDemoData(page);
    await page.goto('/expenses');
    const row = page.locator('[data-expense-row]').first();
    await row.waitFor({ state: 'visible' });
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    if (!box) throw new Error('expense row has no box');

    // Long-press (pointerdown held > 500ms) enters selection mode.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    const bar = page.locator('[data-selection-bar]');
    await expect(bar).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-fixes/selection-bar.png' });

    // Every action label is present (textContent is truncation-agnostic) ...
    await expect(bar).toContainText('selecionad');
    await expect(bar).toContainText('Categoria');
    await expect(bar).toContainText('Mover de fundo');
    await expect(bar).toContainText('Excluir');

    // ... and every action button sits fully inside the viewport with real width
    // (the bug pushed the leftmost actions off-screen behind the count label).
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport');
    const buttons = bar.locator('button');
    await expect(buttons).toHaveCount(4); // cancel + 3 expense actions
    for (let i = 1; i < 4; i++) {
      const b = await buttons.nth(i).boundingBox();
      if (!b) throw new Error(`action button ${i} has no box`);
      expect(b.x, `action ${i} left edge on-screen`).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.width, `action ${i} right edge on-screen`).toBeLessThanOrEqual(
        viewport.width + 0.5,
      );
      expect(b.width, `action ${i} has real width`).toBeGreaterThan(20);
    }
  });
});
