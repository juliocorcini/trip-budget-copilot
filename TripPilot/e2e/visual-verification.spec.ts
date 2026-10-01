import { test, expect } from '@playwright/test';
import path from 'path';

const VIEWPORT = { width: 375, height: 812 };
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

test.use({ viewport: VIEWPORT });

test.describe('Itinerary Visual Verification — PVV Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('capture itinerary empty state', async ({ page }) => {
    await page.goto('/itinerary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'itinerary-empty-state.png'),
      fullPage: true,
    });
  });

  test('capture itinerary with legs (transit day)', async ({ page }) => {
    await page.goto('/itinerary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'itinerary-transit-day.png'),
      fullPage: true,
    });
  });

  test('capture itinerary with legs (full day)', async ({ page }) => {
    await page.goto('/itinerary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'itinerary-full-day.png'),
      fullPage: true,
    });
  });

  test('capture itinerary GPS override state', async ({ page }) => {
    await page.goto('/itinerary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'itinerary-gps-override.png'),
      fullPage: true,
    });
  });

  test('capture itinerary context card on dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'dashboard-context-card.png'),
      fullPage: true,
    });
  });

  test('capture booking checklist page', async ({ page }) => {
    await page.goto('/itinerary/checklist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'booking-checklist.png'),
      fullPage: true,
    });
  });

  test('capture copilot flow — choice stage', async ({ page }) => {
    await page.goto('/itinerary/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'copilot-choice.png'),
      fullPage: true,
    });
  });

  test('capture itinerary map page', async ({ page }) => {
    await page.goto('/itinerary/map');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'itinerary-map.png'),
      fullPage: true,
    });
  });
});
