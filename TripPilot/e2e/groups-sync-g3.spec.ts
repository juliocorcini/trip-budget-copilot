import { test, expect } from '@playwright/test';

// Grupos, Sincronia & Nuvem — G3 (1.2.2-rc): create a group with inline people.
// Covers A01 (the create form seeds people; the new event opens pre-populated) and
// A02 reuse (add keeps focus, clears, advances). Creating with zero extra people
// still works — exercised by G1/G2 (which create owner-only groups and pass).

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /demo|demonstração/i }).click();
  await page.waitForURL('/dashboard');
}

test.describe('Groups wave G3 — create with inline people', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemoData(page);
  });

  test('seeds people inline (focus advances) and opens pre-populated (A01/A02)', async ({ page }) => {
    await page.goto('/groups');
    const newBtn = page.getByRole('button', { name: /novo grupo|new group/i });
    if (await newBtn.isVisible().catch(() => false)) await newBtn.click();

    // Name = the first textbox in the create form.
    await page.getByRole('textbox').first().fill('G3 People');

    // Add two people inline; the field keeps focus and clears between adds (A02).
    const personInput = page.getByPlaceholder(/nome da pessoa|person's name|nombre de la persona/i);
    await personInput.fill('Bruno');
    await page.getByRole('button', { name: /^adicionar$|^add$/i }).click();
    await expect(personInput).toBeFocused();
    await expect(personInput).toHaveValue('');
    await personInput.fill('Carla');
    await page.getByRole('button', { name: /^adicionar$|^add$/i }).click();

    // Create → the new event opens pre-populated with owner + both people.
    await page.getByRole('button', { name: /^criar$|^create$/i }).click();
    await page.waitForURL(/\/groups\/[^/]+$/);
    await expect(page.getByText('Bruno')).toBeVisible();
    await expect(page.getByText('Carla')).toBeVisible();
  });

  test('a half-typed name in the field is folded in on create (never dropped)', async ({ page }) => {
    await page.goto('/groups');
    const newBtn = page.getByRole('button', { name: /novo grupo|new group/i });
    if (await newBtn.isVisible().catch(() => false)) await newBtn.click();
    await page.getByRole('textbox').first().fill('G3 Pending');

    // Type a name but DON'T press Add — it must still land on the event.
    await page.getByPlaceholder(/nome da pessoa|person's name|nombre de la persona/i).fill('Diego');
    await page.getByRole('button', { name: /^criar$|^create$/i }).click();
    await page.waitForURL(/\/groups\/[^/]+$/);
    await expect(page.getByText('Diego')).toBeVisible();
  });
});
