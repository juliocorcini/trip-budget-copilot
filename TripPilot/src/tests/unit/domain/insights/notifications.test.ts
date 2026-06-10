import { describe, it, expect } from 'vitest';
import {
  buildNotifications,
  LONG_OUTING_THRESHOLD_MS,
  type BuildNotificationsInput,
} from '@/domain/insights';

const NOW_MS = new Date('2026-06-10T20:00:00.000Z').getTime();

function baseInput(overrides: Partial<BuildNotificationsInput> = {}): BuildNotificationsInput {
  return {
    pendingShareCount: 0,
    pendingShareImpactCents: 0,
    todayEvents: [],
    backupDue: false,
    activeSession: null,
    nowMs: NOW_MS,
    phaseSpentCents: 0,
    phaseBudgetCents: 100_000,
    ...overrides,
  };
}

describe('buildNotifications (DEC-090 / R-08)', () => {
  it('quiet state → empty list (empty notifications center)', () => {
    expect(buildNotifications(baseInput())).toEqual([]);
  });

  it('pending shares → warning pointing to the confirmation sheet', () => {
    const list = buildNotifications(
      baseInput({ pendingShareCount: 2, pendingShareImpactCents: 4_000 }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe('pending_share');
    expect(list[0]!.tone).toBe('warning');
    expect(list[0]!.values.count).toBe(2);
    expect(list[0]!.values.impactCents).toBe(4_000);
    expect(list[0]!.destination).toBe('/dashboard?confirmShares=1');
  });

  it("today's events → one notification each, tap starts the session", () => {
    const list = buildNotifications(
      baseInput({
        todayEvents: [
          { id: 'occ-1', name: 'Veneza' },
          { id: 'occ-2', name: 'Parral' },
        ],
      }),
    );
    expect(list).toHaveLength(2);
    expect(list[0]!.destination).toBe('/outings/new?occurrence=occ-1');
    expect(list[1]!.values.name).toBe('Parral');
  });

  it('backup due → neutral notification to the backup screen', () => {
    const list = buildNotifications(baseInput({ backupDue: true }));
    expect(list[0]!.kind).toBe('backup_due');
    expect(list[0]!.destination).toBe('/settings/backup');
  });

  it('outing running ≥8h → long_outing; shorter outings stay silent', () => {
    const startedLong = new Date(NOW_MS - LONG_OUTING_THRESHOLD_MS - 60_000).toISOString();
    const startedShort = new Date(NOW_MS - 2 * 3_600_000).toISOString();

    const long = buildNotifications(
      baseInput({ activeSession: { id: 's1', name: 'Bar do Zé', startedAt: startedLong } }),
    );
    expect(long).toHaveLength(1);
    expect(long[0]!.kind).toBe('long_outing');
    expect(long[0]!.values.hours).toBe(8);
    expect(long[0]!.destination).toBe('/outings/active');

    const short = buildNotifications(
      baseInput({ activeSession: { id: 's1', name: 'Bar do Zé', startedAt: startedShort } }),
    );
    expect(short).toEqual([]);
  });

  it('phase over budget → error with the exact overflow', () => {
    const list = buildNotifications(
      baseInput({ phaseSpentCents: 110_000, phaseBudgetCents: 100_000 }),
    );
    expect(list[0]!.kind).toBe('phase_over_budget');
    expect(list[0]!.tone).toBe('error');
    expect(list[0]!.values.overCents).toBe(10_000);
    expect(list[0]!.destination).toBe('/planner');
  });

  it('badge count = list length with multiple signals stacked', () => {
    const list = buildNotifications(
      baseInput({
        pendingShareCount: 1,
        pendingShareImpactCents: 500,
        todayEvents: [{ id: 'occ-1', name: 'Veneza' }],
        backupDue: true,
      }),
    );
    expect(list).toHaveLength(3);
  });
});
