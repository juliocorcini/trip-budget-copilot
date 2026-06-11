import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { endOutingSession, registerExpense } from '@/domain/orchestrators';
import { createSession, deriveSessionLimits } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer } from '@/domain/splitting';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { ActivityProfile } from '@/domain/types/activity-profile';

const mkProfile = (overrides: Partial<ActivityProfile> = {}): ActivityProfile => ({
  ...createSyncMetadata(),
  tripId: 'trip-1',
  name: 'Bar',
  category: 'bar',
  iconName: null,
  color: null,
  typicalValueCents: 4000,
  safeValueCents: 5200,
  confidence: 'low',
  dataPointCount: 2,
  expectedFrequencyPerPhase: null,
  isCustom: false,
  defaultTargetCents: 3000,
  defaultCeilingCents: 5000,
  defaultMaxCents: 7000,
  defaultAvgDrinkPriceCents: 800,
  quickAddValuesCents: null,
  notes: null,
  ...overrides,
});

const mkSessionTx = (sessionId: string, amountCents: number, profileId: string) =>
  createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'Bar',
    sessionId,
    activityProfileId: profileId,
  });

describe('endOutingSession orchestrator', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.sessions.clear(),
      db.activityProfiles.clear(),
      db.participantShares.clear(),
    ]);
  });

  it('applies batch wallet, flags, learning and completes the session atomically', async () => {
    const profile = mkProfile();
    await db.activityProfiles.add(profile);
    const session = createSession({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      activityProfileId: profile.id,
      name: 'Bar night',
      limits: deriveSessionLimits(profile),
      quickAddValuesCents: [300, 500],
    });
    await db.sessions.add(session);
    const tx1 = mkSessionTx(session.id, 2000, profile.id);
    const tx2 = mkSessionTx(session.id, 3000, profile.id);
    await db.transactions.bulkAdd([tx1, tx2]);

    const result = await endOutingSession({
      session,
      transactions: [tx1, tx2],
      walletId: 'wallet-cash',
      ownerParticipantId: null,
      isSpecialOccasion: false,
      excludeFromLearning: false,
      totalAdjustment: null,
      profile,
    });

    expect(result.session.status).toBe('completed');
    expect(result.session.endedAt).not.toBeNull();

    const storedTxs = await db.transactions.toArray();
    expect(storedTxs.every((t) => t.walletId === 'wallet-cash')).toBe(true);
    expect(storedTxs.every((t) => t.isSpecialOccasion === false)).toBe(true);

    // Learning: 2 data points folded in → count 2 → 4
    const storedProfile = await db.activityProfiles.get(profile.id);
    expect(storedProfile!.dataPointCount).toBe(4);
    expect(storedProfile!.typicalValueCents).not.toBe(profile.typicalValueCents);
    expect(storedProfile!.safeValueCents).toBe(Math.round(storedProfile!.typicalValueCents * 1.3));
  });

  it('special occasion: flags persisted, profile untouched (DEC-006)', async () => {
    const profile = mkProfile();
    await db.activityProfiles.add(profile);
    const session = createSession({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      activityProfileId: profile.id,
      name: 'Birthday',
      limits: deriveSessionLimits(profile),
      quickAddValuesCents: [300],
    });
    await db.sessions.add(session);
    const tx = mkSessionTx(session.id, 9000, profile.id);
    await db.transactions.add(tx);

    await endOutingSession({
      session,
      transactions: [tx],
      walletId: null,
      ownerParticipantId: null,
      isSpecialOccasion: true,
      excludeFromLearning: false,
      totalAdjustment: null,
      profile,
    });

    const storedTx = await db.transactions.get(tx.id);
    expect(storedTx!.isSpecialOccasion).toBe(true);
    const storedProfile = await db.activityProfiles.get(profile.id);
    expect(storedProfile!.dataPointCount).toBe(2);
    expect(storedProfile!.typicalValueCents).toBe(4000);
  });

  it('DEC-114: batch wallet is NEVER assigned to items paid by someone else', async () => {
    const profile = mkProfile();
    const session = createSession({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      activityProfileId: profile.id,
      name: 'Bar night',
      limits: deriveSessionLimits(profile),
      quickAddValuesCents: [300],
    });
    await db.sessions.add(session);
    const ownTx = mkSessionTx(session.id, 2000, profile.id);
    const anaTx = {
      ...mkSessionTx(session.id, 1500, profile.id),
      isShared: true,
      paidByParticipantId: 'ana',
      personalCostCents: 1500,
    };
    await db.transactions.bulkAdd([ownTx, anaTx]);

    await endOutingSession({
      session,
      transactions: [ownTx, anaTx],
      walletId: 'wallet-cash',
      ownerParticipantId: 'julio',
      isSpecialOccasion: false,
      excludeFromLearning: false,
      totalAdjustment: null,
      profile: null,
    });

    const storedOwn = await db.transactions.get(ownTx.id);
    const storedAna = await db.transactions.get(anaTx.id);
    expect(storedOwn!.walletId).toBe('wallet-cash');
    // Ana paid → my wallet was never moved.
    expect(storedAna!.walletId).toBeNull();
  });

  it('persists the optional reported-total adjustment with the batch wallet', async () => {
    const profile = mkProfile();
    const session = createSession({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      activityProfileId: profile.id,
      name: 'Bar night',
      limits: deriveSessionLimits(profile),
      quickAddValuesCents: [300],
    });
    await db.sessions.add(session);
    const tx = mkSessionTx(session.id, 3000, profile.id);
    await db.transactions.add(tx);
    const adjustment = mkSessionTx(session.id, 1500, profile.id);

    await endOutingSession({
      session,
      transactions: [tx],
      walletId: 'wallet-cash',
      ownerParticipantId: null,
      isSpecialOccasion: false,
      excludeFromLearning: true,
      totalAdjustment: adjustment,
      profile,
    });

    const stored = await db.transactions.get(adjustment.id);
    expect(stored).toBeDefined();
    expect(stored!.walletId).toBe('wallet-cash');
    expect(stored!.excludeFromLearning).toBe(true);
  });
});

describe('registerExpense orchestrator', () => {
  beforeEach(async () => {
    await Promise.all([db.transactions.clear(), db.participantShares.clear()]);
  });

  it('persists transaction and shares atomically', async () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 9000,
      currency: 'EUR',
      category: 'restaurant',
      description: 'Dinner',
      isShared: true,
      paidByParticipantId: 'p1',
    });
    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: 9000,
      participantIds: ['p1', 'p2', 'p3'],
      paidByParticipantId: 'p1',
      shareType: 'equal',
      customAmountsCents: {},
    });

    await registerExpense({ transaction: tx, shares });

    expect(await db.transactions.count()).toBe(1);
    expect(await db.participantShares.count()).toBe(3);
    const storedShares = await db.participantShares.toArray();
    const payerShare = storedShares.find((s) => s.participantId === 'p1');
    expect(payerShare!.isPaid).toBe(true);
    expect(storedShares.reduce((sum, s) => sum + s.shareAmountCents, 0)).toBe(9000);
  });
});

describe('deriveSessionLimits fallback (GAP-015)', () => {
  it('uses explicit profile defaults when present', () => {
    const limits = deriveSessionLimits(mkProfile());
    expect(limits).toEqual({
      targetCents: 3000,
      ceilingCents: 5000,
      maxCents: 7000,
      avgDrinkPriceCents: 800,
    });
  });

  it('derives ordered €5-rounded limits for profiles without defaults', () => {
    const limits = deriveSessionLimits(
      mkProfile({
        defaultTargetCents: null,
        defaultCeilingCents: null,
        defaultMaxCents: null,
        defaultAvgDrinkPriceCents: null,
        typicalValueCents: 4200,
        safeValueCents: 5460,
      }),
    );
    expect(limits.targetCents % 500).toBe(0);
    expect(limits.ceilingCents % 500).toBe(0);
    expect(limits.maxCents % 500).toBe(0);
    expect(limits.targetCents).toBeGreaterThan(0);
    expect(limits.ceilingCents).toBeGreaterThan(limits.targetCents);
    expect(limits.maxCents).toBeGreaterThan(limits.ceilingCents);
  });

  it('never produces a dead gauge even for near-zero profiles', () => {
    const limits = deriveSessionLimits(
      mkProfile({
        defaultTargetCents: null,
        defaultCeilingCents: null,
        defaultMaxCents: null,
        typicalValueCents: 0,
        safeValueCents: 0,
      }),
    );
    expect(limits.targetCents).toBeGreaterThan(0);
    expect(limits.ceilingCents).toBeGreaterThan(limits.targetCents);
    expect(limits.maxCents).toBeGreaterThan(limits.ceilingCents);
  });
});
