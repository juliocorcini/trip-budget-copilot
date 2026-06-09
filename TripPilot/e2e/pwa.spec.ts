import { test, expect } from '@playwright/test';

test.describe('PWA features', () => {
  test('should have PWA manifest link', async ({ page }) => {
    await page.goto('/');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', '/manifest.json');
  });

  test('should serve valid manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    const json = await response?.json();
    expect(json.name).toBe('TripPilot');
    expect(json.icons).toHaveLength(3);
    expect(json.start_url).toBe('/');
    expect(json.display).toBe('standalone');
  });

  test('should have meta theme-color', async ({ page }) => {
    await page.goto('/');
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute('content', '#0F1419');
  });

  test('should have apple-mobile-web-app-capable meta', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(meta).toHaveAttribute('content', 'yes');
  });

  test('should serve icons', async ({ page }) => {
    const res192 = await page.goto('/icons/icon-192.png');
    expect(res192?.status()).toBe(200);

    const res512 = await page.goto('/icons/icon-512.png');
    expect(res512?.status()).toBe(200);
  });
});
