import { describe, it, expect } from 'vitest';
import {
  buildNotifications,
  LONG_OUTING_THRESHOLD_MS,
  type BuildNotificationsInput,
} from '@/domain/insights';
import { resolveShareBirthStatus, findPendingConfirmationShares } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Transaction } from '@/domain/types/transaction';

const NOW_MS = new Date('2026-06-10T20:00:00.000Z').getTime();

function baseInput(overrides: Partial<BuildNotificationsInput> = {}): BuildNotificationsInput {
  return {
    inboundP2pCount: 0,
    pendingShareCount: 0,
    pendingShareImpactCents: 0,
    pendingSharePeerNames: [],
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

  it('inbound P2P (DEC-352) → warning FIRST, pointing to settle-up', () => {
    const list = buildNotifications(
      baseInput({ inboundP2pCount: 2, pendingShareCount: 1, pendingShareImpactCents: 500 }),
    );
    // A peer waiting on me is the most time-sensitive — it leads the list.
    expect(list[0]!.kind).toBe('pending_p2p');
    expect(list[0]!.tone).toBe('warning');
    expect(list[0]!.values.count).toBe(2);
    expect(list[0]!.destination).toBe('/shared');
  });

  it('DEC-450: pending shares → directional "waiting on {names}", landing on /shared', () => {
    const list = buildNotifications(
      baseInput({
        pendingShareCount: 2,
        pendingShareImpactCents: 4_000,
        pendingSharePeerNames: ['Bruno', 'Ana'],
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe('pending_share');
    // Informative, not imperative — the owner has nothing to confirm here.
    expect(list[0]!.tone).toBe('neutral');
    expect(list[0]!.values.count).toBe(2);
    expect(list[0]!.values.impactCents).toBe(4_000);
    expect(list[0]!.values.names).toBe('Bruno, Ana');
    // Never the owner's confirmation sheet — /shared has remind/charge.
    expect(list[0]!.destination).toBe('/shared');
  });

  it('DEC-450 AC-negative: a split with ONLY non-connected people yields zero pending shares → zero notification', () => {
    // Non-connected participants are born `confirmed` (DEC-241/DL-1) — pin the
    // whole chain: birth status → pending finder → notification builder.
    const ownerId = 'owner';
    const connected = new Set<string>(); // nobody paired
    const tx = {
      id: 'tx-1',
      isShared: true,
      type: 'expense',
      deletedAt: null,
      paidByParticipantId: ownerId,
    } as unknown as Transaction;
    const shares = ['debora', 'rafa'].map(
      (participantId) =>
        ({
          id: `share-${participantId}`,
          transactionId: 'tx-1',
          participantId,
          shareAmountCents: 1_500,
          deletedAt: null,
          confirmationStatus: resolveShareBirthStatus(participantId, false, connected),
        }) as unknown as ParticipantShare,
    );

    const pending = findPendingConfirmationShares([tx], shares, ownerId);
    expect(pending).toEqual([]);

    const list = buildNotifications(
      baseInput({
        pendingShareCount: pending.length,
        pendingShareImpactCents: 0,
        pendingSharePeerNames: [],
      }),
    );
    expect(list).toEqual([]);
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
