import { db } from '@/data/db/database';
import { markUpdated } from '@/utils/entity-factory';
import { APP_SETTINGS_ID } from '@/data/db/seed';
import { computePoolTransfer, createEnvelope } from '@/domain/budget';
import { markPhaseLeftoverHandled } from '@/domain/phases';

/**
 * E5 (M10) — applying a phase-leftover decision. Three destinations, all
 * atomic and all marking the ended phase as handled so the sheet never reopens
 * for the same cycle (M9 DONE):
 *
 * - carry_next: the money simply stays free in the operational pool (no-op
 *   beyond marking handled — the next phase already sees it).
 * - reserve:    a protected_reserve envelope is created on the operational pool;
 *   pool totals are untouched, so the trip total is preserved (ÂNCORA 13).
 * - shopping:   an atomic pool→pool transfer (source ↓ = target ↑); the trip
 *   total is invariant (computePoolTransfer, ÂNCORA 13/15).
 */
export type PhaseLeftoverDestination = 'carry_next' | 'reserve' | 'shopping';

export interface ApplyPhaseLeftoverInput {
  endedPhaseId: string;
  sourcePoolId: string;
  amountCents: number;
  destination: PhaseLeftoverDestination;
  /** Required for 'shopping' — the global pool that receives the money. */
  targetPoolId: string | null;
  /** Localized envelope name for 'reserve' (UI supplies the t() string). */
  reserveName: string;
}

export async function applyPhaseLeftover(input: ApplyPhaseLeftoverInput): Promise<void> {
  await db.transaction('rw', [db.budgetPools, db.envelopes, db.appSettings], async () => {
    // Every path marks the ended phase handled — including a plain dismiss
    // (carry_next) — so the decision sheet shows exactly once (M9 DONE).
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (settings) {
      await db.appSettings.put({
        ...settings,
        phaseLeftoverHandled: markPhaseLeftoverHandled(
          settings.phaseLeftoverHandled ?? [],
          input.endedPhaseId,
        ),
      });
    }

    if (input.destination === 'carry_next' || input.amountCents <= 0) return;

    if (input.destination === 'reserve') {
      await db.envelopes.add(
        createEnvelope({
          budgetPoolId: input.sourcePoolId,
          kind: 'protected_reserve',
          name: input.reserveName,
          amountCents: input.amountCents,
        }),
      );
      return;
    }

    // 'shopping' — pool→pool transfer preserving the trip total.
    if (input.targetPoolId === null) return;
    const [source, target] = await Promise.all([
      db.budgetPools.get(input.sourcePoolId),
      db.budgetPools.get(input.targetPoolId),
    ]);
    if (!source || !target) return;

    const moved = computePoolTransfer(
      source.totalAmountCents,
      target.totalAmountCents,
      input.amountCents,
    );
    await db.budgetPools.put(markUpdated({ ...source, totalAmountCents: moved.sourceTotalCents }));
    await db.budgetPools.put(markUpdated({ ...target, totalAmountCents: moved.targetTotalCents }));
  });
}
