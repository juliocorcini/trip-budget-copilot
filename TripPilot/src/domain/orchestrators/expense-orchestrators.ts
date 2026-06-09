import { db } from '@/data/db/database';
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
