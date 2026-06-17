import { db } from '@/data/db/database';
import { markUpdated } from '@/utils/entity-factory';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';

export interface RegisterExpenseInput {
  transaction: Transaction;
  shares: ParticipantShare[];
}

/**
 * Persists an expense and its participant shares atomically (D-H / GAP-030).
 * Prevents orphan shares when one of the two writes fails.
 */
export async function registerExpense(input: RegisterExpenseInput): Promise<Transaction> {
  await db.transaction('rw', [db.transactions, db.participantShares], async () => {
    await db.transactions.add(input.transaction);
    if (input.shares.length > 0) {
      await db.participantShares.bulkAdd(input.shares);
    }
  });
  return input.transaction;
}

/**
 * B8 (DEC-212): persists a real income transaction. It carries no shares, so a
 * single add is enough; kept as its own orchestrator (not `registerExpense`) so
 * the call site reads honestly as "income", not "expense".
 */
export async function registerIncome(transaction: Transaction): Promise<Transaction> {
  await db.transactions.add(transaction);
  return transaction;
}

export interface EnrichTransactionSharesInput {
  transaction: Transaction;
  shares: ParticipantShare[];
}

/**
 * Post-add enrichment (DEC-078): updates an ALREADY-SAVED transaction with
 * payer/split data and inserts its shares atomically. Shares follow DEC-071
 * (built upstream via buildSharesWithPayer: payer confirmed, others pending).
 */
export async function enrichTransactionShares(
  input: EnrichTransactionSharesInput,
): Promise<Transaction> {
  const updated = markUpdated(input.transaction);
  await db.transaction('rw', [db.transactions, db.participantShares], async () => {
    await db.transactions.put(updated);
    if (input.shares.length > 0) {
      await db.participantShares.bulkAdd(input.shares);
    }
  });
  return updated;
}
