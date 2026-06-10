import { db } from '@/data/db/database';
import { markUpdated } from '@/utils/entity-factory';
import { calculateOwnerPersonalCost } from '@/domain/splitting';
import type { ShareConfirmationStatus } from '@/domain/types/participant-share';

export interface ResolveShareInput {
  shareId: string;
  status: Exclude<ShareConfirmationStatus, 'pending'>;
  /** Optional adjusted value (confirm with a different amount). null = keep. */
  adjustedAmountCents: number | null;
  ownerId: string;
}

/**
 * DEC-071: confirms or rejects a pending share, then recomputes the
 * transaction's personal cost (a rejected share returns its value to the
 * payer). Atomic across participantShares + transactions.
 */
export async function resolveShareConfirmation(input: ResolveShareInput): Promise<void> {
  await db.transaction('rw', [db.participantShares, db.transactions], async () => {
    const share = await db.participantShares.get(input.shareId);
    if (!share || share.deletedAt !== null) return;

    const updatedShare = markUpdated({
      ...share,
      confirmationStatus: input.status,
      shareAmountCents:
        input.status === 'confirmed' && input.adjustedAmountCents !== null
          ? input.adjustedAmountCents
          : share.shareAmountCents,
    });
    await db.participantShares.put(updatedShare);

    const transaction = await db.transactions.get(share.transactionId);
    if (!transaction || transaction.deletedAt !== null) return;

    const txShares = await db.participantShares
      .where('transactionId')
      .equals(transaction.id)
      .toArray();

    const personalCostCents = calculateOwnerPersonalCost(transaction, txShares, input.ownerId);
    await db.transactions.put(markUpdated({ ...transaction, personalCostCents }));
  });
}
