import { db } from '@/data/db/database';
import { createDefaultAppSettings, createCurrentDevice } from '@/data/db/seed';

/**
 * FIELD item 3: "zerar o app". Two flavors, both run after the caller has saved
 * a backup file (and, for keep-structure, a restore point). The DB writes happen
 * in a single transaction so a reset is all-or-nothing.
 */

/** Tables that hold recorded activity ("lançamentos") — cleared by both resets. */
export const TRANSACTIONAL_TABLE_NAMES = [
  'transactions',
  'participantShares',
  'sessions',
  'sessionItems',
  'settlements',
  'forecastSnapshots',
  'mirroredStatements',
  'mailboxQueue',
  // DEC-206 (G1): images belong to recorded activity, so a keep-structure reset
  // drops them too (avoids orphan photos pointing at cleared expenses/outings).
  'attachments',
  // T16 (bill split): divisions describe recorded activity (and in-progress
  // drafts ARE recorded activity), so a keep-structure reset drops them too —
  // same rationale as attachments (no orphan splitMeta pointing at cleared
  // sessions/expenses).
  'splitSessions',
] as const;

/**
 * Keep the trip skeleton (trip, phases, funds, participants, wallets, planners)
 * but wipe every recorded entry — like starting the same trip from a blank
 * ledger. Reserves stay: planned items reopen so their reservation is active
 * again, and their now-dangling links to cleared activity are reset.
 */
export async function resetKeepStructure(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TRANSACTIONAL_TABLE_NAMES) {
      await db.table(name).clear();
    }
    await db.plannedPurchases.toCollection().modify((purchase) => {
      purchase.status = 'planned';
      purchase.linkedTransactionIds = [];
    });
    await db.plannedOccurrences.toCollection().modify((occurrence) => {
      occurrence.linkedSessionId = null;
    });
  });
}

/**
 * Factory reset: clear everything and re-seed the defaults, so the next boot
 * lands on onboarding. The caller is responsible for the safety backup file and
 * for clearing the localStorage emergency snapshot (so boot does not offer to
 * restore the data the traveler just chose to wipe).
 */
export async function resetWipeAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.appSettings.put(createDefaultAppSettings());
    await db.devices.add(createCurrentDevice());
  });
}
