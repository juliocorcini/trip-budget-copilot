import { db } from '@/data/db/database';
import { endSession } from '@/domain/outing';
import { updateProfileFromTransaction } from '@/domain/forecasting';
import { isPaidByOwner } from '@/domain/splitting';
import { markUpdated } from '@/utils/entity-factory';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

export interface EndOutingSessionInput {
  session: Session;
  /** Final session items (amount/description edits already applied by the review UI). */
  transactions: Transaction[];
  /** Batch wallet assignment — applied to items still without a wallet (DEC-049). */
  walletId: string | null;
  /** DEC-114: items paid by someone else NEVER receive the batch wallet. */
  ownerParticipantId: string | null;
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
        // DEC-114: someone else paid → my wallet was never moved, so the
        // batch wallet must not be assigned to that item.
        walletId: isPaidByOwner(tx, input.ownerParticipantId)
          ? (tx.walletId ?? input.walletId)
          : tx.walletId,
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
    [db.transactions, db.sessions, db.activityProfiles, db.plannedOccurrences],
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

      // DEC-072 (M6.4): a session linked to a planned event confirms the
      // occurrence — its reserve stops deducting and real spending takes over.
      const occurrence = await db.plannedOccurrences
        .filter((o) => o.linkedSessionId === input.session.id && o.deletedAt === null)
        .first();
      if (occurrence && !occurrence.isConfirmed) {
        await db.plannedOccurrences.put(
          markUpdated({
            ...occurrence,
            isConfirmed: true,
            linkedTransactionId: finalTransactions[0]?.id ?? null,
          }),
        );
      }
    },
  );

  return { session: completedSession, updatedProfile };
}

export interface StartSessionForOccurrenceInput {
  session: Session;
  occurrenceId: string;
}

/**
 * DEC-072 (M6.3): "Start now" on the day card creates the outing session and
 * links the occurrence atomically — the link stops the reserve deduction.
 */
export async function startSessionForOccurrence(
  input: StartSessionForOccurrenceInput,
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.plannedOccurrences], async () => {
    await db.sessions.add(input.session);
    const occurrence = await db.plannedOccurrences.get(input.occurrenceId);
    if (occurrence && occurrence.deletedAt === null) {
      await db.plannedOccurrences.put(
        markUpdated({ ...occurrence, linkedSessionId: input.session.id }),
      );
    }
  });
}

export interface StartOneOffEventSessionInput {
  session: Session;
  /** Freshly built (not yet persisted) occurrence for the one-off event. */
  occurrence: PlannedOccurrence;
}

/**
 * DEC-073 (M6.5 / FIELD-04): a one-off custom session creates a linked
 * PlannedOccurrence instead of an ActivityProfile — no Planner/Profiles
 * contamination.
 */
export async function startOneOffEventSession(
  input: StartOneOffEventSessionInput,
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.plannedOccurrences], async () => {
    await db.sessions.add(input.session);
    await db.plannedOccurrences.add({ ...input.occurrence, linkedSessionId: input.session.id });
  });
}
