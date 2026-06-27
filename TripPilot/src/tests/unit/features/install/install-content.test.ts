import { describe, it, expect } from 'vitest';
import {
  installAudience,
  columnRecommendation,
  comparisonColumns,
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

describe('COMPARISON_ROWS (Item A, DEC-362/364)', () => {
  it('exposes at least the four core capabilities with valid support levels', () => {
    const valid = new Set(['yes', 'partial', 'no']);
    expect(COMPARISON_ROWS.length).toBeGreaterThanOrEqual(4);
    COMPARISON_ROWS.forEach((row) => {
      [row.app, row.pwa, row.web].forEach((level) => expect(valid.has(level)).toBe(true));
    });
  });

  it('drops the OTA "updates" row (DEC-364 A4) so it never appears for any audience', () => {
    expect(COMPARISON_ROWS.some((r) => r.id === 'updates')).toBe(false);
  });

  it('keeps the installed app at least as capable as the bare web tab on every remaining row', () => {
    const appTotal = COMPARISON_ROWS.reduce((sum, r) => sum + LEVEL_SCORE[r.app], 0);
    const webTotal = COMPARISON_ROWS.reduce((sum, r) => sum + LEVEL_SCORE[r.web], 0);
    expect(appTotal).toBeGreaterThan(webTotal);
    // With the OTA "updates" row gone, the native APK column dominates the bare
    // web tab on EVERY remaining capability — no inversion is allowed anymore.
    const inversions = COMPARISON_ROWS.filter((r) => LEVEL_SCORE[r.web] > LEVEL_SCORE[r.app]);
    expect(inversions.map((r) => r.id)).toEqual([]);
  });
});

describe('comparisonColumns (DEC-364 A2/A3)', () => {
  it('shows the App (APK) column only on Android', () => {
    expect(comparisonColumns('android')).toEqual(['app', 'pwa', 'web']);
  });

  it('hides the App (APK) column where an APK cannot be installed (iOS/desktop)', () => {
    (['ios', 'desktop', 'installed'] as InstallAudience[]).forEach((audience) => {
      const columns = comparisonColumns(audience);
      expect(columns).not.toContain('app');
      expect(columns).toEqual(['pwa', 'web']);
    });
  });
});
