import { createExpenseTransaction, createIncomeTransaction } from '@/domain/transactions';
import { registerExpense, registerIncome, transferBetweenWallets, withdrawCash } from '@/domain/orchestrators';
import { resolvePayerExpense, createSettlement, createParticipant, calculateDebts } from '@/domain/splitting';
import { createPlannedPurchase } from '@/domain/planning';
import { placeToTransactionFields } from '@/domain/location';
import {
  transactionRepository,
  participantShareRepository,
  settlementRepository,
  plannedPurchaseRepository,
  participantRepository,
} from '@/data/repositories';
import { notifyAppDataChanged } from '@/hooks/useAppData';
import type { ExecOp } from './plan';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';

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
}

export interface DispatchContext {
  transactions: Transaction[];
  participants: Participant[];
  ownerId: string;
}

/** Runs a resolved op; never returns until the write is committed. */
export async function executeOp(op: ExecOp, ctx: DispatchContext): Promise<ExecutionResult> {
  switch (op.kind) {
    case 'expense':
      return executeExpense(op);
    case 'income':
      return executeIncome(op);
    case 'transfer':
    case 'withdraw':
      return executeTransfer(op);
    case 'settle':
      return executeSettle(op, ctx);
    case 'plan_purchase':
      return executePlanPurchase(op);
  }
}

async function executeExpense(op: Extract<ExecOp, { kind: 'expense' }>): Promise<ExecutionResult> {
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
  notifyAppDataChanged();

  return {
    summaryKey: 'saved',
    undo: async () => {
      await softDeleteTransactionWithShares(tx.id);
      notifyAppDataChanged();
    },
  };
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
 * Creates a participant the model named but the trip didn't have yet. A
 * non-connected person (no paired device) means a debt born to them shows up
 * immediately (DEC-241) — exactly what the field flow needs.
 */
export async function createAssistantParticipant(tripId: string, name: string): Promise<Participant> {
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
