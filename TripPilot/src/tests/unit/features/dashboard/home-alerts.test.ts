import { describe, it, expect } from 'vitest';
import { selectHomeAlertIds, type HomeAlertConditions } from '@/features/dashboard/home-alerts';

/**
 * DEC-293 (M03/M10) — the top-of-home alerts collapse into one rotating slot.
 * This proves the selection rule: the demo never shows fear banners, a real
 * install orders data-loss risk before the transparency notice, and nothing is
 * invented when the conditions are false.
 *
 * DEC-380 adds dedupe: when the dedicated InstallNudge banner already owns the
 * install prompt, the carousel drops the redundant install/storage card —
 * unless it is a genuine backup CTA (a distinct action that is kept).
 */
const base: HomeAlertConditions = {
  isDemo: false,
  storageAtRisk: false,
  locationNoticeActive: false,
  installNudgeActive: false,
  backupCtaActive: false,
};

describe('selectHomeAlertIds — top-of-home alert selection (DEC-293)', () => {
  it('shows only the calm demo notice in demo, even if other flags are on', () => {
    expect(
      selectHomeAlertIds({
        ...base,
        isDemo: true,
        storageAtRisk: true,
        locationNoticeActive: true,
        installNudgeActive: true,
      }),
    ).toEqual(['demo']);
  });

  it('orders storage-risk before the location notice on a real install', () => {
    expect(
      selectHomeAlertIds({ ...base, storageAtRisk: true, locationNoticeActive: true }),
    ).toEqual(['storage_warning', 'location_notice']);
  });

  it('returns just the storage warning when only that risk is active', () => {
    expect(selectHomeAlertIds({ ...base, storageAtRisk: true })).toEqual(['storage_warning']);
  });

  it('returns just the location notice when only it is active', () => {
    expect(selectHomeAlertIds({ ...base, locationNoticeActive: true })).toEqual(['location_notice']);
  });

  it('returns nothing when no condition is met (calm first glance)', () => {
    expect(selectHomeAlertIds(base)).toEqual([]);
  });
});

describe('selectHomeAlertIds — install/storage dedupe (DEC-380)', () => {
  it('drops the storage card when the InstallNudge already owns the install prompt', () => {
    expect(
      selectHomeAlertIds({ ...base, storageAtRisk: true, installNudgeActive: true }),
    ).toEqual([]);
  });

  it('keeps a real backup CTA even while the InstallNudge shows (distinct action)', () => {
    expect(
      selectHomeAlertIds({
        ...base,
        storageAtRisk: true,
        installNudgeActive: true,
        backupCtaActive: true,
      }),
    ).toEqual(['storage_warning']);
  });

  it('keeps the storage card when no InstallNudge is showing (e.g. snoozed)', () => {
    expect(
      selectHomeAlertIds({ ...base, storageAtRisk: true, installNudgeActive: false }),
    ).toEqual(['storage_warning']);
  });

  it('never hides the location notice via the dedupe', () => {
    expect(
      selectHomeAlertIds({
        ...base,
        storageAtRisk: true,
        locationNoticeActive: true,
        installNudgeActive: true,
      }),
    ).toEqual(['location_notice']);
  });
});
