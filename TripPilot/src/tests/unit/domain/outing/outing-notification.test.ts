import { describe, it, expect } from 'vitest';
import {
  buildOutingNotificationPayload,
  pickNotificationQuickValues,
  pickFollowupSubcategoryIds,
  OUTING_NOTIFICATION_TAG,
} from '@/domain/outing';
import { createSession } from '@/domain/outing';
import type { Session } from '@/domain/types/session';
import type { OutingNotificationStrings } from '@/domain/outing';

// DEC-120 (R-11): the app precomputes the whole notification payload —
// labels, amounts and follow-up subcategories — for the service worker.

const mkSession = (quickAddValuesCents: number[]): Session =>
  createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: 'p-bar',
    name: 'Bar night',
    limits: { targetCents: 1500, ceilingCents: 2500, maxCents: 3500, avgDrinkPriceCents: 500 },
    quickAddValuesCents,
  });

const STRINGS: OutingNotificationStrings = {
  title: 'Active outing: Bar night',
  body: 'Total so far: €20.00',
  bodyTemplate: 'Total so far: {{total}}',
  openAction: 'Open app',
  followupTitle: 'What was that expense?',
  followupBodyTemplate: '{{amount}} logged — tap to detail',
};

describe('pickNotificationQuickValues', () => {
  it('takes the first two distinct positive values', () => {
    expect(pickNotificationQuickValues([300, 300, 500, 800])).toEqual([300, 500]);
  });

  it('ignores non-positive values', () => {
    expect(pickNotificationQuickValues([0, -100, 700])).toEqual([700]);
  });
});

describe('pickFollowupSubcategoryIds', () => {
  it('returns the closest bar subcategories for a beer-sized amount', () => {
    // bar taxonomy: beer 500 and snack 500 are the closest to 500.
    expect(pickFollowupSubcategoryIds('bar', 500)).toEqual(['bar_beer', 'bar_snack']);
  });

  it('falls back to the generic taxonomy without a profile', () => {
    // generic: drink 400 (Δ0) and other 500 (Δ100) are the closest to 400.
    const ids = pickFollowupSubcategoryIds(null, 400);
    expect(ids).toEqual(['generic_drink', 'generic_other']);
  });
});

describe('buildOutingNotificationPayload', () => {
  const payload = buildOutingNotificationPayload({
    session: mkSession([300, 500, 800]),
    totalCents: 2000,
    currency: 'EUR',
    profileCategory: 'bar',
    strings: STRINGS,
    resolveSubcategoryLabel: (id) => `label:${id}`,
    deviceId: 'device-1',
    locale: 'en',
  });

  it('builds two quick-add actions plus the open action', () => {
    expect(payload.tag).toBe(OUTING_NOTIFICATION_TAG);
    expect(payload.actions).toHaveLength(3);
    expect(payload.actions[0]).toEqual({ action: 'quick_add_0', title: '+€3.00' });
    expect(payload.actions[1]).toEqual({ action: 'quick_add_1', title: '+€5.00' });
    expect(payload.actions[2]).toEqual({ action: 'open', title: 'Open app' });
  });

  it('maps each action to its amount for the SW fallback', () => {
    expect(payload.data.amounts).toEqual({ quick_add_0: 300, quick_add_1: 500 });
  });

  it('precomputes labelled follow-up subcategories per amount', () => {
    expect(payload.data.followups['500']).toEqual([
      { subcategoryId: 'bar_beer', label: 'label:bar_beer' },
      { subcategoryId: 'bar_snack', label: 'label:bar_snack' },
    ]);
    expect(payload.data.followups['300']).toHaveLength(2);
  });

  it('carries the strings and device id for SW-side re-rendering', () => {
    expect(payload.data.strings.bodyTemplate).toBe('Total so far: {{total}}');
    expect(payload.data.deviceId).toBe('device-1');
    expect(payload.data.sessionId).toBeTruthy();
  });
});
