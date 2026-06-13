import { db } from '@/data/db/database';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export interface CreateTripFromOnboardingInput {
  trip: Trip;
  phase: Phase;
  pool: BudgetPool;
  link: BudgetPoolPhaseLink;
  reserve: Envelope | null;
  owner: Participant;
  wallets: Wallet[];
  profiles: ActivityProfile[];
}

/**
 * BUG-013: persist a brand-new trip atomically. The eight inserts run inside a
 * single Dexie transaction, so an interruption (crash, app switch) can never
 * leave a half-built trip — missing pool/wallet/profiles — on disk. The caller
 * flips appSettings.activeTrip only AFTER this resolves, which keeps the active
 * pointer from ever referencing a rolled-back trip (appSettings is therefore
 * intentionally NOT part of this transaction).
 */
export async function createTripFromOnboarding(
  input: CreateTripFromOnboardingInput,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.trips,
      db.phases,
      db.budgetPools,
      db.budgetPoolPhaseLinks,
      db.envelopes,
      db.participants,
      db.wallets,
      db.activityProfiles,
    ],
    async () => {
      await db.trips.add(input.trip);
      await db.phases.add(input.phase);
      await db.budgetPools.add(input.pool);
      await db.budgetPoolPhaseLinks.add(input.link);
      if (input.reserve) await db.envelopes.add(input.reserve);
      await db.participants.add(input.owner);
      await db.wallets.bulkAdd(input.wallets);
      if (input.profiles.length > 0) await db.activityProfiles.bulkAdd(input.profiles);
    },
  );
}
