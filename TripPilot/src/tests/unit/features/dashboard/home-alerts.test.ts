import { describe, it, expect } from 'vitest';
import { selectHomeAlertIds } from '@/features/dashboard/home-alerts';

/**
 * DEC-293 (M03/M10) — the top-of-home alerts collapse into one rotating slot.
 * This proves the selection rule: the demo never shows fear banners, a real
 * install orders data-loss risk before the transparency notice, and nothing is
 * invented when the conditions are false.
 */
describe('selectHomeAlertIds — top-of-home alert selection (DEC-293)', () => {
  it('shows only the calm demo notice in demo, even if other flags are on', () => {
    expect(
      selectHomeAlertIds({ isDemo: true, storageAtRisk: true, locationNoticeActive: true }),
    ).toEqual(['demo']);
  });

  it('orders storage-risk before the location notice on a real install', () => {
    expect(
      selectHomeAlertIds({ isDemo: false, storageAtRisk: true, locationNoticeActive: true }),
    ).toEqual(['storage_warning', 'location_notice']);
  });

  it('returns just the storage warning when only that risk is active', () => {
    expect(
      selectHomeAlertIds({ isDemo: false, storageAtRisk: true, locationNoticeActive: false }),
    ).toEqual(['storage_warning']);
  });

  it('returns just the location notice when only it is active', () => {
    expect(
      selectHomeAlertIds({ isDemo: false, storageAtRisk: false, locationNoticeActive: true }),
    ).toEqual(['location_notice']);
  });

  it('returns nothing when no condition is met (calm first glance)', () => {
    expect(
      selectHomeAlertIds({ isDemo: false, storageAtRisk: false, locationNoticeActive: false }),
    ).toEqual([]);
  });
});
