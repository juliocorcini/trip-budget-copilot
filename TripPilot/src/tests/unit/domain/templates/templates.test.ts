import { describe, it, expect } from 'vitest';
import {
  buildTripTemplate,
  summarizeTemplate,
  instantiateTemplate,
  detectTripPriorsOffer,
  markTripPriorsHandled,
  upsertTemplate,
  removeTemplate,
} from '@/domain/templates';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { TripTemplate } from '@/domain/types/trip-template';

const mkTrip = (overrides: Partial<Trip> = {}): Trip => ({
  ...createSyncMetadata(),
  id: 'trip-1',
  name: 'Lisboa',
  baseCurrency: 'EUR',
  startDate: '2026-06-01',
  endDate: '2026-06-10',
  status: 'active',
  notes: null,
  ...overrides,
});

const mkPhase = (overrides: Partial<Phase> = {}): Phase => ({
  ...createSyncMetadata(),
  id: 'phase-1',
  tripId: 'trip-1',
  name: 'City',
  startDate: '2026-06-01',
  endDate: '2026-06-05',
  order: 0,
  rhythmPreset: 'moderate',
  peakDays: [5, 6],
  notes: null,
  ...overrides,
});

const mkProfile = (overrides: Partial<ActivityProfile> = {}): ActivityProfile => ({
  ...createSyncMetadata(),
  id: 'prof-1',
  tripId: 'trip-1',
  name: 'Bar',
  category: 'bar',
  iconName: 'local_bar',
  color: '#C75B39',
  typicalValueCents: 2200,
  safeValueCents: 3000,
  confidence: 'high',
  dataPointCount: 12,
  expectedFrequencyPerPhase: 5,
  isCustom: false,
  defaultTargetCents: 2000,
  defaultCeilingCents: 2800,
  defaultMaxCents: 3600,
  defaultAvgDrinkPriceCents: 350,
  quickAddValuesCents: [300, 500],
  notes: null,
  ...overrides,
});

const mkTemplate = (overrides: Partial<TripTemplate> = {}): TripTemplate => ({
  id: 'tpl-1',
  name: 'Lisboa',
  createdAt: '2026-06-11T00:00:00.000Z',
  baseCurrency: 'EUR',
  phases: [
    { name: 'City', order: 0, durationDays: 5, rhythmPreset: 'moderate', peakDays: [5, 6] },
    { name: 'Coast', order: 1, durationDays: 5, rhythmPreset: 'relaxed', peakDays: null },
  ],
  profiles: [
    {
      name: 'Bar',
      category: 'bar',
      iconName: 'local_bar',
      color: '#C75B39',
      typicalValueCents: 2200,
      safeValueCents: 3000,
      expectedFrequencyPerPhase: 5,
      isCustom: false,
      defaultTargetCents: 2000,
      defaultCeilingCents: 2800,
      defaultMaxCents: 3600,
      defaultAvgDrinkPriceCents: 350,
      quickAddValuesCents: [300, 500],
    },
  ],
  ...overrides,
});

describe('buildTripTemplate (M22 — serialize a trip into a reusable mold)', () => {
  it('captures the learned cost shape and phase structure without ids', () => {
    const template = buildTripTemplate({
      id: 'tpl-x',
      name: 'Lisboa',
      createdAt: '2026-06-11T00:00:00.000Z',
      baseCurrency: 'EUR',
      phases: [mkPhase()],
      profiles: [mkProfile()],
    });

    expect(template.profiles).toHaveLength(1);
    const p = template.profiles[0]!;
    expect(p.typicalValueCents).toBe(2200);
    expect(p.safeValueCents).toBe(3000);
    expect(p.category).toBe('bar');
    // No id / tripId / metadata leak into the template.
    expect(p).not.toHaveProperty('id');
    expect(p).not.toHaveProperty('tripId');
    expect(p).not.toHaveProperty('dataPointCount');
  });

  it('computes phase durationDays from the dates and keeps them ordered', () => {
    const template = buildTripTemplate({
      id: 'tpl-x',
      name: 'T',
      createdAt: 'now',
      baseCurrency: 'EUR',
      phases: [
        mkPhase({ id: 'b', name: 'Coast', order: 1, startDate: '2026-06-06', endDate: '2026-06-10' }),
        mkPhase({ id: 'a', name: 'City', order: 0, startDate: '2026-06-01', endDate: '2026-06-05' }),
      ],
      profiles: [],
    });

    expect(template.phases.map((p) => p.name)).toEqual(['City', 'Coast']);
    expect(template.phases[0]!.durationDays).toBe(5);
    expect(template.phases[1]!.durationDays).toBe(5);
  });

  it('drops soft-deleted phases and profiles', () => {
    const template = buildTripTemplate({
      id: 'tpl-x',
      name: 'T',
      createdAt: 'now',
      baseCurrency: 'EUR',
      phases: [mkPhase(), mkPhase({ id: 'gone', deletedAt: '2026-06-02T00:00:00.000Z' })],
      profiles: [mkProfile(), mkProfile({ id: 'gone', deletedAt: '2026-06-02T00:00:00.000Z' })],
    });

    expect(template.phases).toHaveLength(1);
    expect(template.profiles).toHaveLength(1);
  });
});

describe('summarizeTemplate', () => {
  it('counts phases and profiles', () => {
    expect(summarizeTemplate(mkTemplate())).toEqual({ phaseCount: 2, profileCount: 1 });
  });
});

describe('instantiateTemplate (M23 — recreate the structure on a new trip)', () => {
  it('mints cold profiles under the new trip with the learned typicals', () => {
    const { profiles } = instantiateTemplate({
      template: mkTemplate(),
      tripId: 'trip-NEW',
      budgetPoolId: 'pool-NEW',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      deviceId: 'dev-1',
      now: '2026-08-20T00:00:00.000Z',
    });

    expect(profiles).toHaveLength(1);
    const p = profiles[0]!;
    expect(p.tripId).toBe('trip-NEW');
    expect(p.typicalValueCents).toBe(2200);
    expect(p.safeValueCents).toBe(3000);
    // The new trip re-learns from scratch — confidence/data reset.
    expect(p.confidence).toBe('low');
    expect(p.dataPointCount).toBe(0);
    expect(p.id).not.toBe('prof-1');
  });

  it('lays the phases contiguously across the new date range', () => {
    const { phases, links } = instantiateTemplate({
      template: mkTemplate(),
      tripId: 'trip-NEW',
      budgetPoolId: 'pool-NEW',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      deviceId: 'dev-1',
      now: '2026-05-20T00:00:00.000Z',
    });

    expect(phases).toHaveLength(2);
    expect(phases[0]!.startDate).toBe('2026-06-01');
    expect(phases[0]!.endDate).toBe('2026-06-05');
    expect(phases[1]!.startDate).toBe('2026-06-06');
    expect(phases[1]!.endDate).toBe('2026-06-10');
    expect(phases.map((p) => p.order)).toEqual([0, 1]);
    // One link per phase, all pointing to the trip's operational pool.
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.budgetPoolId === 'pool-NEW')).toBe(true);
    expect(links.map((l) => l.phaseId)).toEqual(phases.map((p) => p.id));
  });

  it('spans the full range for a single-phase template', () => {
    const { phases } = instantiateTemplate({
      template: mkTemplate({
        phases: [{ name: 'All', order: 0, durationDays: 7, rhythmPreset: null, peakDays: null }],
      }),
      tripId: 'trip-NEW',
      budgetPoolId: 'pool-NEW',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      deviceId: 'dev-1',
      now: 'now',
    });

    expect(phases).toHaveLength(1);
    expect(phases[0]!.startDate).toBe('2026-06-01');
    expect(phases[0]!.endDate).toBe('2026-06-10');
  });
});

describe('detectTripPriorsOffer (M21 — offer once when the trip is over)', () => {
  it('offers when the trip ended, has profiles, and was not handled', () => {
    const offer = detectTripPriorsOffer({
      trip: mkTrip(),
      todayIso: '2026-06-11',
      profiles: [mkProfile(), mkProfile({ id: 'p2' })],
      handledTripIds: [],
    });
    expect(offer).toEqual({ tripId: 'trip-1', tripName: 'Lisboa', profileCount: 2 });
  });

  it('stays silent while the trip is still running (incl. the last day)', () => {
    expect(
      detectTripPriorsOffer({
        trip: mkTrip(),
        todayIso: '2026-06-10',
        profiles: [mkProfile()],
        handledTripIds: [],
      }),
    ).toBeNull();
  });

  it('stays silent once handled, or with nothing learned', () => {
    expect(
      detectTripPriorsOffer({
        trip: mkTrip(),
        todayIso: '2026-06-11',
        profiles: [mkProfile()],
        handledTripIds: ['trip-1'],
      }),
    ).toBeNull();
    expect(
      detectTripPriorsOffer({
        trip: mkTrip(),
        todayIso: '2026-06-11',
        profiles: [],
        handledTripIds: [],
      }),
    ).toBeNull();
  });
});

describe('template list helpers', () => {
  it('markTripPriorsHandled appends idempotently', () => {
    expect(markTripPriorsHandled([], 'trip-1')).toEqual(['trip-1']);
    expect(markTripPriorsHandled(['trip-1'], 'trip-1')).toEqual(['trip-1']);
  });

  it('upsertTemplate puts the newest first and replaces by id', () => {
    const a = mkTemplate({ id: 'a', name: 'A' });
    const b = mkTemplate({ id: 'b', name: 'B' });
    const list = upsertTemplate(upsertTemplate([], a), b);
    expect(list.map((t) => t.id)).toEqual(['b', 'a']);

    const replaced = upsertTemplate(list, mkTemplate({ id: 'a', name: 'A2' }));
    expect(replaced.map((t) => t.id)).toEqual(['a', 'b']);
    expect(replaced.find((t) => t.id === 'a')!.name).toBe('A2');
  });

  it('removeTemplate drops the matching id', () => {
    const list = [mkTemplate({ id: 'a' }), mkTemplate({ id: 'b' })];
    expect(removeTemplate(list, 'a').map((t) => t.id)).toEqual(['b']);
  });
});
