import { db } from '@/data/db/database';
import { markUpdated, softDelete } from '@/utils/entity-factory';
import { sortPhasesByOrder } from '@/domain/dates';

export type DeletePoolResult =
  | { ok: true }
  | { ok: false; reason: 'has_transactions'; transactionCount: number };

export interface DeleteBudgetPoolInput {
  poolId: string;
  /** Pool that absorbs the active transactions. null = block when any exist. */
  reassignToPoolId: string | null;
}

/**
 * DEC-080: soft-deletes a fund. With active transactions, either reassigns
 * them to another pool or blocks. Cascades soft delete to phase links,
 * envelopes and future reserve policies. Atomic.
 */
export async function deleteBudgetPool(input: DeleteBudgetPoolInput): Promise<DeletePoolResult> {
  return db.transaction(
    'rw',
    [db.budgetPools, db.budgetPoolPhaseLinks, db.envelopes, db.futurePhaseReservePolicies, db.transactions],
    async () => {
      const activeTxs = await db.transactions
        .where('budgetPoolId')
        .equals(input.poolId)
        .filter((tx) => tx.deletedAt === null)
        .toArray();

      if (activeTxs.length > 0) {
        if (input.reassignToPoolId === null) {
          return { ok: false as const, reason: 'has_transactions' as const, transactionCount: activeTxs.length };
        }
        for (const tx of activeTxs) {
          await db.transactions.put(markUpdated({ ...tx, budgetPoolId: input.reassignToPoolId }));
        }
      }

      const pool = await db.budgetPools.get(input.poolId);
      if (pool && pool.deletedAt === null) {
        await db.budgetPools.put(softDelete(pool));
      }

      const [links, envelopes, policies] = await Promise.all([
        db.budgetPoolPhaseLinks.where('budgetPoolId').equals(input.poolId).filter((l) => l.deletedAt === null).toArray(),
        db.envelopes.where('budgetPoolId').equals(input.poolId).filter((e) => e.deletedAt === null).toArray(),
        db.futurePhaseReservePolicies.where('budgetPoolId').equals(input.poolId).filter((p) => p.deletedAt === null).toArray(),
      ]);
      for (const link of links) await db.budgetPoolPhaseLinks.put(softDelete(link));
      for (const envelope of envelopes) await db.envelopes.put(softDelete(envelope));
      for (const policy of policies) await db.futurePhaseReservePolicies.put(softDelete(policy));

      return { ok: true as const };
    },
  );
}

export type DeletePhaseResult =
  | { ok: true }
  | { ok: false; reason: 'has_data'; transactionCount: number; sessionCount: number }
  | { ok: false; reason: 'last_phase' };

/**
 * DEC-080: soft-deletes a phase. Blocks when the phase has transactions or
 * sessions ("move or delete the X expenses first") or when it is the last
 * phase of the trip. Cascades to links, plans, allocations, settings and
 * occurrences; reorders the remaining phases. Atomic.
 */
export async function deletePhase(phaseId: string): Promise<DeletePhaseResult> {
  return db.transaction(
    'rw',
    [
      db.phases,
      db.transactions,
      db.sessions,
      db.budgetPoolPhaseLinks,
      db.scenarioPlans,
      db.scenarioAllocationItems,
      db.phaseProfileSettings,
      db.plannedOccurrences,
      db.futurePhaseReservePolicies,
    ],
    async () => {
      const phase = await db.phases.get(phaseId);
      if (!phase || phase.deletedAt !== null) return { ok: true as const };

      const siblings = await db.phases
        .where('tripId')
        .equals(phase.tripId)
        .filter((p) => p.deletedAt === null)
        .toArray();
      if (siblings.length <= 1) {
        return { ok: false as const, reason: 'last_phase' as const };
      }

      const [transactionCount, sessionCount] = await Promise.all([
        db.transactions.where('phaseId').equals(phaseId).filter((tx) => tx.deletedAt === null).count(),
        db.sessions.where('phaseId').equals(phaseId).filter((s) => s.deletedAt === null).count(),
      ]);
      if (transactionCount > 0 || sessionCount > 0) {
        return { ok: false as const, reason: 'has_data' as const, transactionCount, sessionCount };
      }

      await db.phases.put(softDelete(phase));

      const [links, plans, settings, occurrences, policies] = await Promise.all([
        db.budgetPoolPhaseLinks.where('phaseId').equals(phaseId).filter((l) => l.deletedAt === null).toArray(),
        db.scenarioPlans.where('phaseId').equals(phaseId).filter((p) => p.deletedAt === null).toArray(),
        db.phaseProfileSettings.where('phaseId').equals(phaseId).filter((s) => s.deletedAt === null).toArray(),
        db.plannedOccurrences.where('phaseId').equals(phaseId).filter((o) => o.deletedAt === null).toArray(),
        db.futurePhaseReservePolicies.where('phaseId').equals(phaseId).filter((p) => p.deletedAt === null).toArray(),
      ]);
      for (const link of links) await db.budgetPoolPhaseLinks.put(softDelete(link));
      for (const setting of settings) await db.phaseProfileSettings.put(softDelete(setting));
      for (const occurrence of occurrences) await db.plannedOccurrences.put(softDelete(occurrence));
      for (const policy of policies) await db.futurePhaseReservePolicies.put(softDelete(policy));
      for (const plan of plans) {
        await db.scenarioPlans.put(softDelete(plan));
        const items = await db.scenarioAllocationItems
          .where('scenarioPlanId')
          .equals(plan.id)
          .filter((i) => i.deletedAt === null)
          .toArray();
        for (const item of items) await db.scenarioAllocationItems.put(softDelete(item));
      }

      // Compact the order of the remaining phases (0..n-1).
      const remaining = sortPhasesByOrder(siblings.filter((p) => p.id !== phaseId));
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i]!.order !== i) {
          await db.phases.put(markUpdated({ ...remaining[i]!, order: i }));
        }
      }

      return { ok: true as const };
    },
  );
}

/** DEC-080: swaps the order of two adjacent phases. Atomic. */
export async function swapPhaseOrder(phaseIdA: string, phaseIdB: string): Promise<void> {
  await db.transaction('rw', [db.phases], async () => {
    const [a, b] = await Promise.all([db.phases.get(phaseIdA), db.phases.get(phaseIdB)]);
    if (!a || !b) return;
    const orderA = a.order;
    await db.phases.put(markUpdated({ ...a, order: b.order }));
    await db.phases.put(markUpdated({ ...b, order: orderA }));
  });
}
