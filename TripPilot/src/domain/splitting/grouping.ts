import { sumCents } from '@/domain/money';
import type { Transaction } from '@/domain/types/transaction';
import type { StatementLine } from './splitting';

/**
 * DEC-206 (device-test 2026-06-20): settle-up GROUPING. A receipt import creates
 * one outing `session` holding N item-transactions that all share the same
 * `sessionId` (the merchant is the session name). Imported with ~40 items, the
 * settle-up screen showed 40 separate cards/lines per person — "ilegível, a tela
 * vai descendo sem parar". These pure helpers collapse same-session expenses into
 * ONE expandable "event" group, leaving standalone expenses untouched. This is
 * DISPLAY-ONLY: amounts, debts and net are computed elsewhere and never changed.
 */

/** A row in the "shared expenses" list: a single expense, or a receipt event. */
export interface SharedExpenseGroup {
  /** Stable React key: the tx id (singletons) or `session:<id>` (events). */
  key: string;
  /** Non-null only for a real multi-item event (a grouped receipt session). */
  sessionId: string | null;
  /** Underlying transactions, newest first. Length 1 for a standalone expense. */
  transactions: Transaction[];
  /** Number of underlying transactions. */
  count: number;
  /** Sum of the bills (transaction amounts), in the group currency. */
  totalCents: number;
  currency: string;
  /** Most recent transaction date in the group (ISO), used to sort the list. */
  occurredAt: string;
}

function singleTxGroup(tx: Transaction): SharedExpenseGroup {
  return {
    key: tx.id,
    sessionId: null,
    transactions: [tx],
    count: 1,
    totalCents: tx.amountCents,
    currency: tx.currency,
    occurredAt: tx.date,
  };
}

/**
 * Groups shared expense transactions by their `sessionId`. A session with a
 * SINGLE item collapses back to a standalone row (no point in an "event" of one).
 * Output is sorted newest-first by the group's most recent date.
 */
export function groupSharedExpenses(transactions: Transaction[]): SharedExpenseGroup[] {
  const bySession = new Map<string, Transaction[]>();
  const groups: SharedExpenseGroup[] = [];

  for (const tx of transactions) {
    if (tx.sessionId) {
      const list = bySession.get(tx.sessionId);
      if (list) list.push(tx);
      else bySession.set(tx.sessionId, [tx]);
    } else {
      groups.push(singleTxGroup(tx));
    }
  }

  for (const [sessionId, list] of bySession) {
    if (list.length === 1) {
      groups.push(singleTxGroup(list[0]!));
      continue;
    }
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    groups.push({
      key: `session:${sessionId}`,
      sessionId,
      transactions: sorted,
      count: sorted.length,
      totalCents: sumCents(sorted.map((t) => t.amountCents)),
      currency: sorted[0]!.currency,
      occurredAt: sorted[0]!.date,
    });
  }

  return groups.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** A row in a participant's itemized statement: a single line, or an event. */
export interface StatementLineGroup {
  key: string;
  sessionId: string | null;
  lines: StatementLine[];
  count: number;
  /** Sum of the viewer's "owes" slices in the group (positive cents). */
  owesCents: number;
  /** Sum of the viewer's "is_owed" slices in the group (positive cents). */
  isOwedCents: number;
  /** Signed net for the group: is_owed − owes. */
  netCents: number;
  /**
   * DEC-474: the group's display currency — the lines' shared ORIGINAL
   * currency (a session/receipt is registered in one currency; same first-item
   * convention as `SharedExpenseGroup.currency`).
   */
  currency: string;
  /** The other side (payer for `owes`, debtor for `is_owed`) of the first line. */
  counterpartyName: string;
  /** Most recent line date (ISO), used to sort. */
  occurredAt: string;
}

function singleLineGroup(line: StatementLine): StatementLineGroup {
  const owes = line.kind === 'owes' ? line.amountCents : 0;
  const isOwed = line.kind === 'is_owed' ? line.amountCents : 0;
  return {
    key: line.transactionId,
    sessionId: null,
    lines: [line],
    count: 1,
    owesCents: owes,
    isOwedCents: isOwed,
    netCents: isOwed - owes,
    currency: line.currency,
    counterpartyName: line.counterpartyName,
    occurredAt: line.occurredAt,
  };
}

/**
 * Groups a participant's statement lines by `sessionId`. A single-item session
 * collapses to a standalone line. Output is sorted newest-first. `lines` keep the
 * order they arrived in (already date-desc from `buildParticipantStatement`).
 */
export function groupStatementLines(lines: StatementLine[]): StatementLineGroup[] {
  const bySession = new Map<string, StatementLine[]>();
  const groups: StatementLineGroup[] = [];

  for (const line of lines) {
    if (line.sessionId) {
      const list = bySession.get(line.sessionId);
      if (list) list.push(line);
      else bySession.set(line.sessionId, [line]);
    } else {
      groups.push(singleLineGroup(line));
    }
  }

  for (const [sessionId, list] of bySession) {
    if (list.length === 1) {
      groups.push(singleLineGroup(list[0]!));
      continue;
    }
    const owesCents = sumCents(list.filter((l) => l.kind === 'owes').map((l) => l.amountCents));
    const isOwedCents = sumCents(list.filter((l) => l.kind === 'is_owed').map((l) => l.amountCents));
    const occurredAt = list.reduce((max, l) => (l.occurredAt > max ? l.occurredAt : max), list[0]!.occurredAt);
    groups.push({
      key: `session:${sessionId}`,
      sessionId,
      lines: list,
      count: list.length,
      owesCents,
      isOwedCents,
      netCents: isOwedCents - owesCents,
      currency: list[0]!.currency,
      counterpartyName: list[0]!.counterpartyName,
      occurredAt,
    });
  }

  return groups.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
