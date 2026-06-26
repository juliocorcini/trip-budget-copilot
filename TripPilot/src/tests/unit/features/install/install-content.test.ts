import { describe, it, expect } from 'vitest';
import {
  installAudience,
  columnRecommendation,
  COMPARISON_ROWS,
  type InstallAudience,
  type InstallColumn,
  type SupportLevel,
} from '@/features/install/install-content';

const LEVEL_SCORE: Record<SupportLevel, number> = { no: 0, partial: 1, yes: 2 };

const AUDIENCES: InstallAudience[] = ['android', 'ios', 'desktop', 'installed'];
const COLUMNS: InstallColumn[] = ['app', 'pwa', 'web'];

describe('installAudience (Item A, DEC-362)', () => {
  it('treats an installed standalone (PWA) as "installed"', () => {
    expect(installAudience('android-pwa')).toBe('installed');
    expect(installAudience('ios-pwa')).toBe('installed');
  });

  it('maps android-web → android and ios-web → ios', () => {
    expect(installAudience('android-web')).toBe('android');
    expect(installAudience('ios-web')).toBe('ios');
  });

  it('falls back to desktop for a plain web tag', () => {
    expect(installAudience('web')).toBe('desktop');
  });
});

describe('columnRecommendation (Item A, DEC-362)', () => {
  it('always discourages the bare web tab, whoever the audience is', () => {
    AUDIENCES.forEach((a) => expect(columnRecommendation('web', a)).toBe('discouraged'));
  });

  it('leads with the APK on Android and with the PWA everywhere else', () => {
    expect(columnRecommendation('app', 'android')).toBe('recommended');
    expect(columnRecommendation('pwa', 'android')).toBe('ok');
    expect(columnRecommendation('app', 'ios')).toBe('ok');
    expect(columnRecommendation('pwa', 'ios')).toBe('recommended');
    expect(columnRecommendation('pwa', 'desktop')).toBe('recommended');
  });

  it('never recommends two columns at once for the same audience', () => {
    AUDIENCES.forEach((a) => {
      const recommended = COLUMNS.map((c) => columnRecommendation(c, a)).filter(
        (r) => r === 'recommended',
      );
      expect(recommended.length).toBeLessThanOrEqual(1);
    });
  });
});

describe('COMPARISON_ROWS (Item A, DEC-362)', () => {
  it('exposes at least the five core capabilities with valid support levels', () => {
    const valid = new Set(['yes', 'partial', 'no']);
    expect(COMPARISON_ROWS.length).toBeGreaterThanOrEqual(5);
    COMPARISON_ROWS.forEach((row) => {
      [row.app, row.pwa, row.web].forEach((level) => expect(valid.has(level)).toBe(true));
    });
  });

  it('keeps the installed app more capable than the bare web tab overall', () => {
    const appTotal = COMPARISON_ROWS.reduce((sum, r) => sum + LEVEL_SCORE[r.app], 0);
    const webTotal = COMPARISON_ROWS.reduce((sum, r) => sum + LEVEL_SCORE[r.web], 0);
    expect(appTotal).toBeGreaterThan(webTotal);
    // The ONLY capability where web/PWA can beat the native APK is OTA updates
    // (the APK needs a manual reinstall). Any other inversion is a data error.
    const inversions = COMPARISON_ROWS.filter((r) => LEVEL_SCORE[r.web] > LEVEL_SCORE[r.app]);
    expect(inversions.map((r) => r.id)).toEqual(['updates']);
  });
});
