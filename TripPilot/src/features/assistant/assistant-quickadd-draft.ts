import type { CurrentPlace, ShareType } from '@/domain/types/common';
import type { ExecOp } from '@/domain/assistant';

/**
 * AI Quick Entry (DEC-246) — the "open full editor" escape hatch. When the AI
 * draft needs the heavy machinery the sheet intentionally does NOT duplicate
 * (foreign currency + rate, custom/unequal split, photos, or just a careful
 * review), the sheet hands the FULLY pre-filled draft to `QuickAddPage` instead
 * of sending the user back to a blank form. The draft is held in a tiny in-memory
 * slot (this is a SPA — navigation never reloads the module) and consumed exactly
 * once, so a later manual open never re-applies a stale draft. No ids/values ever
 * leave the device; this is a pure on-device hand-off between two screens.
 */
export interface AssistantQuickAddDraft {
  /** Drives which QuickAdd mode opens (expense is the only AI-routed kind today). */
  type: 'expense' | 'income' | 'transfer' | 'withdrawal';
  /** Major units (e.g. 12.8), mirroring the QuickAdd amount input. */
  amount: number;
  /** Foreign currency code (so QuickAdd shows the rate field), or null = base. */
  currency: string | null;
  category?: string;
  description?: string;
  /** ISO timestamp/date as produced by the planner (converted on apply). */
  date?: string;
  place?: CurrentPlace | null;
  poolId?: string;
  walletId?: string | null;
  /** Split — payerId null = the owner paid. */
  payerId?: string | null;
  participantIds?: string[];
  shareType?: ShareType;
}

let pending: AssistantQuickAddDraft | null = null;

export function setAssistantQuickAddDraft(draft: AssistantQuickAddDraft): void {
  pending = draft;
}

/** Reads AND clears the draft (single-use), so a manual open never re-applies it. */
export function takeAssistantQuickAddDraft(): AssistantQuickAddDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}

/** Pure: an expense `ExecOp` → the QuickAdd pre-fill draft (the only editable kind). */
export function expenseOpToQuickAddDraft(
  op: Extract<ExecOp, { kind: 'expense' }>,
  baseCurrency: string,
): AssistantQuickAddDraft {
  return {
    type: 'expense',
    amount: op.amountCents / 100,
    currency: op.currency === baseCurrency ? null : op.currency,
    category: op.category,
    description: op.description.trim() === '' ? undefined : op.description,
    date: op.date,
    place: op.place,
    poolId: op.budgetPoolId,
    walletId: op.walletId,
    payerId: op.payerId,
    participantIds: op.participantIds,
    shareType: 'equal',
  };
}

export interface DraftSplitState {
  /** null = the owner paid (QuickAdd's default). */
  paidById: string | null;
  otherPaidSplit: boolean;
  selectedParticipantIds: string[];
  isShared: boolean;
}

/**
 * Pure: maps the draft's payer/participants into QuickAdd's split state. Covers
 * every shape the planner emits: plain expense, "I split with us", "I paid for
 * them" (owner not a sharer), "someone paid the whole thing" (full debt), and
 * "someone paid and we split". QuickAdd's engine then reproduces the same debts.
 */
export function resolveDraftSplitState(
  draft: Pick<AssistantQuickAddDraft, 'payerId' | 'participantIds'>,
  ownerId: string,
): DraftSplitState {
  const participantIds = draft.participantIds ?? [];
  const payerId = draft.payerId ?? null;
  const ownerIsSharer = participantIds.includes(ownerId);

  // Someone else paid.
  if (payerId !== null && payerId !== ownerId) {
    return {
      paidById: payerId,
      // I share only when I'm in the list with at least one more person.
      otherPaidSplit: ownerIsSharer && participantIds.length >= 2,
      selectedParticipantIds: participantIds,
      isShared: false,
    };
  }

  // The owner paid (or unspecified).
  if (participantIds.length === 0) {
    return { paidById: null, otherPaidSplit: false, selectedParticipantIds: [], isShared: false };
  }
  // ownerIsSharer → we split among us; otherwise I covered it for them (owner
  // not selected, so they owe their share and I owe nothing).
  return {
    paidById: null,
    otherPaidSplit: false,
    selectedParticipantIds: participantIds,
    isShared: true,
  };
}

/** Pure: a planner ISO date → an `<input type="datetime-local">` value (local). */
export function isoToDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
