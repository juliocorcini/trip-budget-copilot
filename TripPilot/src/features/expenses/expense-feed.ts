import { localDayOf } from '@/domain/dates';
import { isSplitCommitTransaction } from '@/domain/split';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-206 (rollup): a feed row is either a standalone transaction (an expense, or
 * — D-BUG-04 — an income shown as a distinct line) or a collapsed session
 * (receipt/outing) standing in for its N member transactions.
 */
export type FeedEntry =
  | { kind: 'tx'; date: string; tx: Transaction }
  | { kind: 'session'; date: string; session: Session; txs: Transaction[]; totalCents: number };

export interface FeedDayGroup {
  day: string;
  subtotalCents: number;
  entries: FeedEntry[];
}

/**
 * DEC-206 (rollup): collapse each browsed session's transactions into ONE feed
 * entry positioned at its latest line (a 40-item receipt reads as one row).
 * Income carries no `sessionId`, so it is always a standalone `tx` entry.
 *
 * F2: a committed bill split is ALSO one Session, but holding a single expense
 * (the whole bill) whose detail page shows the readable division (who took what,
 * who owes). Collapsing it into a session rollup routed it to the outing review,
 * which hides that division — visible only under the "sem carteira" filter that
 * happened to disable the rollup. So a split-commit tx is NEVER collapsed: it
 * reads as its own "gasto dividido" row everywhere, and the division is always
 * one tap away. Pure projection — input order is preserved.
 */
export function buildSessionFeed(
  feedTransactions: Transaction[],
  sessionById: Map<string, Session>,
  isBrowsing: boolean,
): FeedEntry[] {
  const feed: FeedEntry[] = [];
  const sessionEntryById = new Map<string, Extract<FeedEntry, { kind: 'session' }>>();
  for (const tx of feedTransactions) {
    const session =
      isBrowsing && tx.sessionId && !isSplitCommitTransaction(tx)
        ? sessionById.get(tx.sessionId)
        : undefined;
    if (session) {
      const existing = sessionEntryById.get(session.id);
      if (existing) {
        existing.txs.push(tx);
        existing.totalCents += tx.amountCents;
      } else {
        const entry = {
          kind: 'session' as const,
          date: tx.date,
          session,
          txs: [tx],
          totalCents: tx.amountCents,
        };
        sessionEntryById.set(session.id, entry);
        feed.push(entry);
      }
    } else {
      feed.push({ kind: 'tx', date: tx.date, tx });
    }
  }
  return feed;
}

/**
 * L1 + D-BUG-04: group the feed by local day with a per-day subtotal. Income
 * rows render inside the day's list but NEVER add to the subtotal — the subtotal
 * answers "what did I SPEND that day?", so only expense `tx` rows and session
 * rollups count (ÂNCORA 11 invariance: a feed with zero income groups exactly as
 * before).
 */
export function groupFeedByDay(feed: FeedEntry[]): FeedDayGroup[] {
  const groups: FeedDayGroup[] = [];
  for (const entry of feed) {
    const day = localDayOf(entry.date);
    const amount =
      entry.kind === 'tx' ? (entry.tx.type === 'income' ? 0 : entry.tx.amountCents) : entry.totalCents;
    const last = groups[groups.length - 1];
    const group = last && last.day === day ? last : null;
    if (group) {
      group.entries.push(entry);
      group.subtotalCents += amount;
    } else {
      groups.push({ day, subtotalCents: amount, entries: [entry] });
    }
  }
  return groups;
}
