import { db } from '@/data/db/database';
import { markUpdated, softDelete } from '@/utils/entity-factory';
import { sortPhasesByOrder } from '@/domain/dates';
import { createPhase } from '@/domain/phases';
import { createBudgetPool, createBudgetPoolPhaseLink, computePoolTransfer } from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPoolScope } from '@/domain/types/common';

export interface CreatePoolPhaseLinkInput {
  phaseId: string;
  /** Future floor for this phase; null or <= 0 means "no floor". */
  floorCents: number | null;
}

export interface CreateBudgetPoolWithLinksInput {
  tripId: string;
  name: string;
  scope: BudgetPoolScope;
  totalAmountCents: number;
  currency: string;
  /** Phase links to create — only used when scope === 'linked_phases'. */
  phaseLinks: CreatePoolPhaseLinkInput[];
}

/**
 * DEC-067 (B13): creates a fund AND its phase links in ONE atomic transaction.
 * FundsPage used to `create` the pool and then the links in separate repository
 * calls, so a failure between them could leave an orphan pool or partial links.
 * A `linked_phases` pool persists its links; a `global` pool ignores any.
 */
export async function createBudgetPoolWithPhaseLinks(
  input: CreateBudgetPoolWithLinksInput,
): Promise<BudgetPool> {
  const pool = createBudgetPool({
    tripId: input.tripId,
    name: input.name,
    scope: input.scope,
    totalAmountCents: input.totalAmountCents,
    currency: input.currency,
  });
  const links =
    input.scope === 'linked_phases'
      ? input.phaseLinks.map((link) =>
          createBudgetPoolPhaseLink(
            pool.id,
            link.phaseId,
            link.floorCents !== null && link.floorCents > 0 ? link.floorCents : null,
          ),
        )
      : [];
  await db.transaction('rw', [db.budgetPools, db.budgetPoolPhaseLinks], async () => {
    await db.budgetPools.add(pool);
    for (const link of links) {
      await db.budgetPoolPhaseLinks.add(link);
    }
  });
  return pool;
}

export interface CreatePhaseWithBudgetInput {
  tripId: string;
  name: string;
  /** Inclusive day the trecho starts (YYYY-MM-DD). */
  startDate: string;
  /** Inclusive day the trecho ends (YYYY-MM-DD). */
  endDate: string;
  order: number;
  budgetCents: number;
  currency: string;
  /** Optional explicit fund name; defaults to the trecho name (the trecho IS its budget). */
  poolName?: string;
}

export interface CreatePhaseWithBudgetResult {
  phase: Phase;
  pool: BudgetPool;
  link: BudgetPoolPhaseLink;
}

/**
 * Canonical "Trecho" creation (master §3.1, D4): a trecho = a Phase with ITS OWN
 * dedicated budget. Creates the Phase, a dedicated `linked_phases` BudgetPool and
 * the 1:1 link in ONE atomic transaction, so a trecho can never exist without its
 * budget (or an orphan pool without its trecho). The pool/link are backend
 * concepts the user never sees on the happy path ("Visão avançada" only).
 */
export async function createPhaseWithBudget(
  input: CreatePhaseWithBudgetInput,
): Promise<CreatePhaseWithBudgetResult> {
  const phase = createPhase({
    tripId: input.tripId,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    order: input.order,
  });
  const pool = createBudgetPool({
    tripId: input.tripId,
    name: input.poolName?.trim() || input.name,
    scope: 'linked_phases',
    totalAmountCents: input.budgetCents,
    currency: input.currency,
  });
  const link = createBudgetPoolPhaseLink(pool.id, phase.id, null);
  await db.transaction(
    'rw',
    [db.phases, db.budgetPools, db.budgetPoolPhaseLinks],
    async () => {
      await db.phases.add(phase);
      await db.budgetPools.add(pool);
      await db.budgetPoolPhaseLinks.add(link);
    },
  );
  return { phase, pool, link };
}

export interface TransferBetweenPoolsInput {
  sourcePoolId: string;
  targetPoolId: string;
  amountCents: number;
}

export type TransferBetweenPoolsResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_amount' | 'pool_not_found' | 'insufficient_funds' };

/**
 * D5/D14 ("remanejar"): move budget from one trecho to another in ONE atomic
 * transaction. The trip total is invariant — the sum of the two fund totals
 * never changes, only how it is split. The amount must be positive and not
 * exceed the source's declared budget (we never push a source negative).
 */
export async function transferBetweenPools(
  input: TransferBetweenPoolsInput,
): Promise<TransferBetweenPoolsResult> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (input.sourcePoolId === input.targetPoolId) {
    return { ok: false, reason: 'invalid_amount' };
  }
  return db.transaction('rw', [db.budgetPools], async () => {
    const [source, target] = await Promise.all([
      db.budgetPools.get(input.sourcePoolId),
      db.budgetPools.get(input.targetPoolId),
    ]);
    if (!source || !target || source.deletedAt !== null || target.deletedAt !== null) {
      return { ok: false, reason: 'pool_not_found' } as const;
    }
    if (input.amountCents > source.totalAmountCents) {
      return { ok: false, reason: 'insufficient_funds' } as const;
    }
    const moved = computePoolTransfer(
      source.totalAmountCents,
      target.totalAmountCents,
      input.amountCents,
    );
    await db.budgetPools.put(markUpdated({ ...source, totalAmountCents: moved.sourceTotalCents }));
    await db.budgetPools.put(markUpdated({ ...target, totalAmountCents: moved.targetTotalCents }));
    return { ok: true } as const;
  });
}

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
