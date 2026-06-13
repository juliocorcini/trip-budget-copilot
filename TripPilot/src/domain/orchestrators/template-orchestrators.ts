import { db } from '@/data/db/database';
import { APP_SETTINGS_ID } from '@/data/db/seed';
import {
  upsertTemplate,
  removeTemplate,
  markTripPriorsHandled as appendTripPriorsHandled,
} from '@/domain/templates';
import type { TripTemplate } from '@/domain/types/trip-template';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { ActivityProfile } from '@/domain/types/activity-profile';

/**
 * E7 (M21/M22/M23) — persistence for trip templates. Templates and the
 * priors-handled list live as non-indexed fields on the single AppSettings row;
 * every write is a read-modify-write inside a transaction so concurrent updates
 * never clobber each other (ÂNCORA 18 — no Dexie table/migration).
 */

/** M22: save (or replace) a template. Newest first, capped — see upsertTemplate. */
export async function saveTripTemplate(template: TripTemplate): Promise<void> {
  await db.transaction('rw', [db.appSettings], async () => {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) return;
    await db.appSettings.put({
      ...settings,
      tripTemplates: upsertTemplate(settings.tripTemplates ?? [], template),
    });
  });
}

/** M22: remove a saved template by id. */
export async function deleteTripTemplate(templateId: string): Promise<void> {
  await db.transaction('rw', [db.appSettings], async () => {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) return;
    await db.appSettings.put({
      ...settings,
      tripTemplates: removeTemplate(settings.tripTemplates ?? [], templateId),
    });
  });
}

/**
 * M21: record that the end-of-trip priors offer for a trip was handled (saved
 * or dismissed) so the sheet never reopens for it.
 */
export async function markTripPriorsHandled(tripId: string): Promise<void> {
  await db.transaction('rw', [db.appSettings], async () => {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) return;
    await db.appSettings.put({
      ...settings,
      tripPriorsHandled: appendTripPriorsHandled(settings.tripPriorsHandled ?? [], tripId),
    });
  });
}

export interface CreateTripFromTemplateInput {
  trip: Trip;
  pool: BudgetPool;
  reserve: Envelope | null;
  owner: Participant;
  wallets: Wallet[];
  phases: Phase[];
  links: BudgetPoolPhaseLink[];
  profiles: ActivityProfile[];
}

/**
 * M23: persist a brand-new trip built from a template, atomically. Mirrors
 * createTripFromOnboarding (BUG-013) but supports the template's MANY phases +
 * links in one transaction — a crash can never leave a half-applied template.
 * appSettings.activeTrip is flipped by the caller AFTER this resolves.
 */
export async function createTripFromTemplate(input: CreateTripFromTemplateInput): Promise<void> {
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
      if (input.phases.length > 0) await db.phases.bulkAdd(input.phases);
      await db.budgetPools.add(input.pool);
      if (input.links.length > 0) await db.budgetPoolPhaseLinks.bulkAdd(input.links);
      if (input.reserve) await db.envelopes.add(input.reserve);
      await db.participants.add(input.owner);
      await db.wallets.bulkAdd(input.wallets);
      if (input.profiles.length > 0) await db.activityProfiles.bulkAdd(input.profiles);
    },
  );
}
