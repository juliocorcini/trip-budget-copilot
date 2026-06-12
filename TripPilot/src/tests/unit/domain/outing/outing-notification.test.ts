import { describe, it, expect } from 'vitest';
import {
  buildOutingNotificationPayload,
  buildOutingNotificationBody,
  pickNotificationQuickValues,
  pickFollowupSubcategoryIds,
  OUTING_NOTIFICATION_TAG,
} from '@/domain/outing';
import { createSession } from '@/domain/outing';
import type { Session } from '@/domain/types/session';
import type { OutingNotificationStrings } from '@/domain/outing';

// DEC-120 + DEC-124 (R-11): the app precomputes the whole notification
// payload — labels, amounts, follow-up subcategories, body templates and
// session limits — for the service worker.

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
  bodyNoTarget: 'Total so far: {{total}}',
  bodyUnderTarget: 'Total {{total}} · {{left}} left to the target',
  bodyOverTarget: 'Total {{total}} · {{over}} over the target',
  drinksToTarget: '≈{{count}} drinks until the target',
  openAction: 'Open app',
  followupTitle: 'What was that expense?',
  followupBodyTemplate: '{{amount}} logged — tap to detail',
};

const euro = (cents: number) => `€${(cents / 100).toFixed(2)}`;

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

describe('buildOutingNotificationBody (DEC-124)', () => {
  it('under the target: total + remaining + drinks estimate', () => {
    const body = buildOutingNotificationBody({
      totalCents: 500,
      targetCents: 1500,
      avgDrinkPriceCents: 500,
      strings: STRINGS,
      format: euro,
    });
    // €10.00 left at €5.00/drink → exactly 2 drinks.
    expect(body).toBe('Total €5.00 · €10.00 left to the target\n≈2 drinks until the target');
  });

  it('omits the drinks line when less than one drink fits', () => {
    const body = buildOutingNotificationBody({
      totalCents: 1200,
      targetCents: 1500,
      avgDrinkPriceCents: 500,
      strings: STRINGS,
      format: euro,
    });
    expect(body).toBe('Total €12.00 · €3.00 left to the target');
  });

  it('over the target: total + overshoot', () => {
    const body = buildOutingNotificationBody({
      totalCents: 2000,
      targetCents: 1500,
      avgDrinkPriceCents: 500,
      strings: STRINGS,
      format: euro,
    });
    expect(body).toBe('Total €20.00 · €5.00 over the target');
  });

  it('without a target: simple total', () => {
    const body = buildOutingNotificationBody({
      totalCents: 700,
      targetCents: null,
      avgDrinkPriceCents: null,
      strings: STRINGS,
      format: euro,
    });
    expect(body).toBe('Total so far: €7.00');
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

  it('renders the rich body (over target at €20 vs €15)', () => {
    expect(payload.body).toContain('over the target');
  });

  it('maps each action to its amount for the SW direct write', () => {
    expect(payload.data.amounts).toEqual({ quick_add_0: 300, quick_add_1: 500 });
  });

  it('precomputes labelled follow-up subcategories per amount', () => {
    expect(payload.data.followups['500']).toEqual([
      { subcategoryId: 'bar_beer', label: 'label:bar_beer' },
      { subcategoryId: 'bar_snack', label: 'label:bar_snack' },
    ]);
    expect(payload.data.followups['300']).toHaveLength(2);
  });

  it('carries strings, limits and device id for SW-side re-rendering', () => {
    expect(payload.data.strings.bodyUnderTarget).toBe('Total {{total}} · {{left}} left to the target');
    expect(payload.data.targetCents).toBe(1500);
    expect(payload.data.avgDrinkPriceCents).toBe(500);
    expect(payload.data.deviceId).toBe('device-1');
    expect(payload.data.sessionId).toBeTruthy();
  });
});
