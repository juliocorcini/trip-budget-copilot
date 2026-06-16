import { db } from '@/data/db/database';
import type { Transaction } from '@/domain/types/transaction';
import type { WiseImportDraft } from '@/domain/import';
import { createExpenseTransaction } from '@/domain/transactions/transactions';

export interface CommitWiseImportInput {
  /** Only the drafts the user chose to import (already filtered + importable). */
  drafts: WiseImportDraft[];
  tripId: string;
  /** Operational pool that owns the imported expenses' budget. */
  budgetPoolId: string;
  /** Wise wallet the card purchases are debited from. */
  walletId: string;
  /** Fallback phase when a draft could not be matched to one by date. */
  fallbackPhaseId: string;
}

export interface CommitWiseImportResult {
  /** Ids of the inserted transactions — drives the undo toast. */
  transactionIds: string[];
}

/**
 * DEC-200: persists the selected Wise rows as expenses, atomically. Every
 * record carries its `externalRef` (`wise:<id>`) so a re-import of the same
 * file is recognized as already-imported, and `excludeFromLearning` so a
 * batch of historical card purchases never skews the quick-value learning.
 *
 * Same-currency rows (the wallet currency equals the row currency) need no
 * conversion; a foreign row falls back to its own amount as the base value
 * (documented multi-currency limitation — the importer does not invent rates).
 * The whole batch is one Dexie transaction: a crash imports all-or-nothing.
 */
export async function commitWiseImport(
  input: CommitWiseImportInput,
): Promise<CommitWiseImportResult> {
  const importable = input.drafts.filter((d) => d.importable);
  if (importable.length === 0) return { transactionIds: [] };

  const transactions: Transaction[] = importable.map((draft) =>
    // The importer never invents exchange rates: the base-currency value equals
    // the original amount (exchangeRate null). For a same-currency statement
    // (the common case — an EUR wallet on an EUR trip) this is exact; a foreign
    // statement keeps its own number as the documented multi-currency fallback.
    createExpenseTransaction({
      tripId: input.tripId,
      phaseId: draft.phaseId ?? input.fallbackPhaseId,
      budgetPoolId: input.budgetPoolId,
      walletId: input.walletId,
      amountCents: draft.amountCents,
      currency: draft.currency,
      baseCurrencyAmountCents: draft.amountCents,
      exchangeRate: null,
      category: draft.category,
      description: draft.description,
      date: draft.dateIso,
      placeLabel: draft.city,
      externalRef: draft.externalRef,
      excludeFromLearning: true,
    }),
  );

  await db.transaction('rw', [db.transactions], async () => {
    await db.transactions.bulkAdd(transactions);
  });

  return { transactionIds: transactions.map((tx) => tx.id) };
}
