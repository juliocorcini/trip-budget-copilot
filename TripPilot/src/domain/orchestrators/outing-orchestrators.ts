import { db } from '@/data/db/database';
import { endSession } from '@/domain/outing';
import { updateProfileFromTransaction } from '@/domain/forecasting';
import { markUpdated } from '@/utils/entity-factory';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export interface EndOutingSessionInput {
  session: Session;
  /** Final session items (amount/description edits already applied by the review UI). */
  transactions: Transaction[];
  /** Batch wallet assignment — applied to items still without a wallet (DEC-049). */
  walletId: string | null;
  isSpecialOccasion: boolean;
  excludeFromLearning: boolean;
  /** Optional "reported total" adjustment built by the review (DEC-046). */
  totalAdjustment: Transaction | null;
  profile: ActivityProfile | null;
}

export interface EndOutingSessionResult {
  session: Session;
  updatedProfile: ActivityProfile | null;
}

/**
 * DEC-049 end-of-session review, applied atomically (D-H / GAP-030):
 * batch wallet → classification flags → optional cash adjustment →
 * profile learning (DEC-006) → session completed.
 */
export async function endOutingSession(
  input: EndOutingSessionInput,
): Promise<EndOutingSessionResult> {
  const finalTransactions = input.transactions
    .filter((tx) => tx.deletedAt === null)
    .map((tx) =>
      markUpdated({
        ...tx,
        walletId: tx.walletId ?? input.walletId,
        isSpecialOccasion: input.isSpecialOccasion,
        excludeFromLearning: input.excludeFromLearning,
      }),
    );

  // DEC-006: special occasions and excluded sessions never teach the profile.
  let updatedProfile: ActivityProfile | null = null;
  if (input.profile && !input.excludeFromLearning && !input.isSpecialOccasion) {
    let working = input.profile;
    for (const tx of finalTransactions.filter((t) => t.type === 'expense')) {
      const learning = updateProfileFromTransaction(
        working,
        tx.personalCostCents ?? tx.amountCents,
        false,
      );
      working = { ...working, ...learning };
    }
    updatedProfile = markUpdated(working);
  }

  const completedSession = markUpdated(endSession(input.session));

  await db.transaction(
    'rw',
    [db.transactions, db.sessions, db.activityProfiles],
    async () => {
      await db.transactions.bulkPut(finalTransactions);
      if (input.totalAdjustment) {
        await db.transactions.add({
          ...input.totalAdjustment,
          walletId: input.totalAdjustment.walletId ?? input.walletId,
          isSpecialOccasion: input.isSpecialOccasion,
          excludeFromLearning: true,
        });
      }
      if (updatedProfile) {
        await db.activityProfiles.put(updatedProfile);
      }
      await db.sessions.put(completedSession);
    },
  );

  return { session: completedSession, updatedProfile };
}
