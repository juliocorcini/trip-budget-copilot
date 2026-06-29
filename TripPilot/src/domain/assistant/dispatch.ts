import { createExpenseTransaction, createIncomeTransaction } from '@/domain/transactions';
import { registerExpense, registerIncome, transferBetweenWallets, withdrawCash } from '@/domain/orchestrators';
import {
  resolvePayerExpense,
  createSettlement,
  createParticipant,
  calculateDebts,
  collectSplitNotifyTargets,
} from '@/domain/splitting';
import { createPlannedPurchase, createPlannedOccurrence } from '@/domain/planning';
import { findParticipantByName } from '@/domain/participants';
import { placeToTransactionFields, placesEqual } from '@/domain/location';
import {
  transactionRepository,
  participantShareRepository,
  settlementRepository,
  plannedPurchaseRepository,
  plannedOccurrenceRepository,
  participantRepository,
  appSettingsRepository,
} from '@/data/repositories';
import { notifyAppDataChanged } from '@/hooks/useAppData';
import { requestPersistentStorage } from '@/utils/pwa';
import { recordExpenseForSnapshot } from '@/utils/emergency-snapshot';
import { recordDailyLocalSnapshot } from '@/utils/local-snapshot';
import type { ExecOp } from './plan';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';
import type { AppSettings } from '@/domain/types/app-settings';
import type { CurrentPlace } from '@/domain/types/common';

/**
 * AI Quick Entry (DEC-246) — the ONLY impure boundary of the feature. It takes a
 * fully-resolved `ExecOp` from the pure planner and runs it through the EXISTING
 * domain orchestrators (no new financial logic). Every op returns an
 * `ExecutionResult` carrying an `undo` closure so the success toast can offer
 * "Desfazer" (DEC-126). The whole device side stays the source of truth for math
 * and persistence — the cloud never wrote anything.
 */

export class AssistantDispatchError extends Error {
  constructor(public readonly code: 'no_debt') {
    super(code);
    this.name = 'AssistantDispatchError';
  }
}

export interface ExecutionResult {
  /** A key under `assistant.done.*` for the success toast. */
  summaryKey: string;
  undo: () => Promise<void>;
  /**
   * B5/DL-5 parity: when a split gave other people a slice, the people to nudge
   * (send their share link) + the amount each owes ME (only populated when I was
   * the payer — otherwise the debt isn't mine to charge). Absent for non-splits.
   */
  splitNudge?: { targets: Participant[]; amountByParticipantId: Map<string, number> };
  /**
   * DEC-389 (G5): the saved expense, so the UI boundary can run the SAME
   * background location stamp QuickAdd does (forward-geocode the captured name,
   * GPS fallback). Only set for expense ops; the domain stays free of GPS/network.
   */
  transaction?: Transaction;
}

export interface DispatchContext {
  transactions: Transaction[];
  participants: Participant[];
  ownerId: string;
  /** Prior sticky values, so an AI expense persists the same prefs QuickAdd does. */
  currentPlace?: CurrentPlace | null;
  lastExpenseCategory?: string | null;
}

/** Runs a resolved op; never returns until the write is committed. */
export async function executeOp(op: ExecOp, ctx: DispatchContext): Promise<ExecutionResult> {
  switch (op.kind) {
    case 'expense':
      return executeExpense(op, ctx);
    case 'income':
      return executeIncome(op);
    case 'transfer':
    case 'withdraw':
      return executeTransfer(op);
    case 'settle':
      return executeSettle(op, ctx);
    case 'plan_purchase':
      return executePlanPurchase(op);
    case 'event':
      return executeEvent(op);
  }
}

async function executeExpense(
  op: Extract<ExecOp, { kind: 'expense' }>,
  ctx: DispatchContext,
): Promise<ExecutionResult> {
  const tx = createExpenseTransaction({
    tripId: op.tripId,
    phaseId: op.phaseId,
    budgetPoolId: op.budgetPoolId,
    walletId: op.walletId,
    amountCents: op.amountCents,
    currency: op.currency,
    category: op.category,
    description: op.description,
    date: op.date,
    // DEC-397 (G6): carry the event attribution so an AI expense consumes the
    // right event reserve (DEC-385). createExpenseTransaction drops any session
    // when an occurrence is set (Â-ATTRIBUTION).
    occurrenceId: op.occurrenceId ?? null,
    ...placeToTransactionFields(op.place),
  });

  let shares: ParticipantShare[] = [];
  // Mirror QuickAdd: only run the payer/split engine when someone else paid or
  // the cost is split — a plain "I paid, all mine" expense needs no shares.
  if (op.payerId !== op.ownerId || op.didSplit) {
    const resolution = resolvePayerExpense({
      transactionId: tx.id,
      amountCents: op.amountCents,
      ownerId: op.ownerId,
      payerId: op.payerId,
      didSplit: op.didSplit,
      participantIds: op.participantIds,
      shareType: 'equal',
      customAmountsCents: {},
      connectedParticipantIds: op.connectedParticipantIds,
    });
    tx.isShared = resolution.isShared;
    tx.paidByParticipantId = op.payerId;
    tx.personalCostCents = resolution.personalCostCents;
    if (!resolution.movesOwnerWallet) tx.walletId = null;
    shares = resolution.shares;
  }

  await registerExpense({ transaction: tx, shares });
  // Parity with QuickAdd.persistExpense: remember the sticky prefs and refresh
  // the safety snapshots so an AI expense leaves the app in the same state a
  // manual one would (the next entry inherits the place + category).
  await persistExpenseStickyPrefs(op, ctx);
  requestPersistentStorage();
  void recordExpenseForSnapshot();
  void recordDailyLocalSnapshot();
  notifyAppDataChanged();

  return {
    summaryKey: 'saved',
    splitNudge: buildSplitNudge(op, shares, ctx),
    transaction: tx,
    undo: async () => {
      await softDeleteTransactionWithShares(tx.id);
      notifyAppDataChanged();
    },
  };
}

/**
 * Pure (B5/DL-5 parity): the post-split nudge — who got a slice (so the owner can
 * send their share link) and, ONLY when the owner paid, how much each owes them
 * (so "Lembrar" charges the right value). Mirrors QuickAdd.commitExpense: targets
 * for any split, amounts gated on the owner being the payer. Returns undefined
 * when nobody else owes (no nudge to show).
 */
export function buildSplitNudge(
  op: Extract<ExecOp, { kind: 'expense' }>,
  shares: ParticipantShare[],
  ctx: DispatchContext,
): ExecutionResult['splitNudge'] {
  const targets = collectSplitNotifyTargets(shares, ctx.participants, ctx.ownerId);
  if (targets.length === 0) return undefined;
  const amountByParticipantId = new Map<string, number>();
  if (op.payerId === op.ownerId) {
    for (const share of shares) {
      amountByParticipantId.set(
        share.participantId,
        (amountByParticipantId.get(share.participantId) ?? 0) + share.shareAmountCents,
      );
    }
  }
  return { targets, amountByParticipantId };
}

/**
 * Pure: the settings delta an expense should persist (DEC-246 parity). Mirrors
 * QuickAdd — remember the place when it changed, and the category as the next
 * default. Returns an empty patch when nothing changed (no write needed).
 */
export function buildExpenseStickyPatch(
  place: CurrentPlace | null,
  category: string,
  prior: { currentPlace?: CurrentPlace | null; lastExpenseCategory?: string | null },
): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};
  if (place !== null && !placesEqual(place, prior.currentPlace ?? null)) {
    patch.currentPlace = place;
  }
  if (category && category !== (prior.lastExpenseCategory ?? null)) {
    patch.lastExpenseCategory = category;
  }
  return patch;
}

/** Mirrors QuickAdd's single sticky write: remember the place + last category. */
async function persistExpenseStickyPrefs(
  op: Extract<ExecOp, { kind: 'expense' }>,
  ctx: DispatchContext,
): Promise<void> {
  const patch = buildExpenseStickyPatch(op.place, op.category, ctx);
  if (Object.keys(patch).length > 0) await appSettingsRepository.update(patch);
}

async function executeIncome(op: Extract<ExecOp, { kind: 'income' }>): Promise<ExecutionResult> {
  const tx = createIncomeTransaction({
    tripId: op.tripId,
    phaseId: op.phaseId,
    budgetPoolId: op.budgetPoolId,
    walletId: op.walletId,
    amountCents: op.amountCents,
    currency: op.currency,
    description: op.description,
  });
  await registerIncome(tx);
  notifyAppDataChanged();
  return {
    summaryKey: 'saved',
    undo: async () => {
      await transactionRepository.delete(tx.id);
      notifyAppDataChanged();
    },
  };
}

async function executeTransfer(op: Extract<ExecOp, { kind: 'transfer' | 'withdraw' }>): Promise<ExecutionResult> {
  const run = op.kind === 'withdraw' ? withdrawCash : transferBetweenWallets;
  const tx = await run({
    tripId: op.tripId,
    phaseId: op.phaseId,
    sourceWalletId: op.sourceWalletId,
    targetWalletId: op.targetWalletId,
    amountCents: op.amountCents,
    currency: op.currency,
    description: op.description,
  });
  notifyAppDataChanged();
  return {
    summaryKey: 'saved',
    undo: async () => {
      await transactionRepository.delete(tx.id);
      notifyAppDataChanged();
    },
  };
}

async function executeSettle(op: Extract<ExecOp, { kind: 'settle' }>, ctx: DispatchContext): Promise<ExecutionResult> {
  const sharedTxIds = ctx.transactions.filter((t) => t.isShared).map((t) => t.id);
  const [shares, settlements] = await Promise.all([
    participantShareRepository.getAllForTrip(sharedTxIds),
    settlementRepository.getByTripId(op.tripId),
  ]);
  const summary = calculateDebts(ctx.transactions, shares, ctx.participants, settlements, ctx.ownerId);

  const debtorId = op.direction === 'i_owe' ? ctx.ownerId : op.personId;
  const creditorId = op.direction === 'i_owe' ? op.personId : ctx.ownerId;
  const debt = summary.debts.find((d) => d.debtorId === debtorId && d.creditorId === creditorId);
  if (!debt) throw new AssistantDispatchError('no_debt');

  const amountCents = op.amountCents ? Math.min(op.amountCents, debt.amountCents) : debt.amountCents;
  const settlement = createSettlement(op.tripId, debtorId, creditorId, amountCents, op.currency);
  await settlementRepository.create(settlement);
  notifyAppDataChanged();

  return {
    summaryKey: 'settled',
    undo: async () => {
      await settlementRepository.delete(settlement.id);
      notifyAppDataChanged();
    },
  };
}

/**
 * DEC-410 (G8): create the event the AI planned — a `PlannedOccurrence`
 * (kind='event') via the SAME factory the manual flows use. An optional
 * consumable reserve (DEC-385) and, when it is happening now, an immediate
 * `startedAt` (DEC-400) so it is live on Home/guide. Undo soft-deletes it.
 */
async function executeEvent(op: Extract<ExecOp, { kind: 'event' }>): Promise<ExecutionResult> {
  const base = createPlannedOccurrence({
    tripId: op.tripId,
    phaseId: op.phaseId,
    budgetPoolId: op.budgetPoolId,
    name: op.name,
    plannedDate: op.dateIso,
    endDate: null,
    kind: 'event',
    estimatedCostCents: op.reservedCents ?? 0,
    reservedCents: op.reservedCents,
    activityProfileId: null,
  });
  const occurrence = op.startNow ? { ...base, startedAt: new Date().toISOString() } : base;
  await plannedOccurrenceRepository.create(occurrence);
  notifyAppDataChanged();
  return {
    summaryKey: op.startNow ? 'event_started' : 'event_planned',
    undo: async () => {
      await plannedOccurrenceRepository.delete(occurrence.id);
      notifyAppDataChanged();
    },
  };
}

async function executePlanPurchase(op: Extract<ExecOp, { kind: 'plan_purchase' }>): Promise<ExecutionResult> {
  const purchase = createPlannedPurchase({
    tripId: op.tripId,
    budgetPoolId: op.budgetPoolId,
    name: op.name,
    category: op.category,
    estimatedCostCents: op.estimatedCostCents,
    phaseId: op.phaseId,
  });
  await plannedPurchaseRepository.create(purchase);
  notifyAppDataChanged();
  return {
    summaryKey: 'planned',
    undo: async () => {
      await plannedPurchaseRepository.delete(purchase.id);
      notifyAppDataChanged();
    },
  };
}

/**
 * Resolves a participant the model named: reuse the trip's existing person when
 * the name already matches (FB-06/24 idempotency — never two "Bruno"s in the
 * ledger), otherwise create a new non-connected one so a debt born to them shows
 * up immediately (DEC-241) — exactly what the field flow needs.
 */
export async function createAssistantParticipant(tripId: string, name: string): Promise<Participant> {
  const existing = await participantRepository.getByTripId(tripId);
  const reused = findParticipantByName(existing, name);
  if (reused) return reused;
  const participant = createParticipant(tripId, name.trim(), null);
  await participantRepository.create(participant);
  notifyAppDataChanged();
  return participant;
}

async function softDeleteTransactionWithShares(transactionId: string): Promise<void> {
  const shares = await participantShareRepository.getByTransactionId(transactionId);
  await Promise.all([
    transactionRepository.delete(transactionId),
    ...shares.map((s) => participantShareRepository.delete(s.id)),
  ]);
}
