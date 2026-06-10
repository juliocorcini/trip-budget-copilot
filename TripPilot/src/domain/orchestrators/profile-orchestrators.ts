import { db } from '@/data/db/database';
import { markUpdated } from '@/utils/entity-factory';
import { createPhaseProfileSetting } from '@/domain/profiles';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export interface CreateProfileEnabledInPhaseInput {
  /** Freshly built (not yet persisted) ActivityProfile. */
  profile: ActivityProfile;
  phaseId: string;
}

/**
 * DEC-074: tapping a preset chip without an existing trip profile creates
 * the ActivityProfile and its enabled phase setting atomically.
 */
export async function createProfileEnabledInPhase(
  input: CreateProfileEnabledInPhaseInput,
): Promise<void> {
  await db.transaction('rw', [db.activityProfiles, db.phaseProfileSettings], async () => {
    await db.activityProfiles.add(input.profile);
    await db.phaseProfileSettings.add(
      createPhaseProfileSetting(input.phaseId, input.profile.id, true),
    );
  });
}

/**
 * DEC-074: toggles a profile on/off in a phase (upsert of the setting row).
 * Absence of a row means enabled, so the row is only meaningful when it
 * flips the default — but keeping it simplifies repeated toggles.
 */
export async function setProfileEnabledInPhase(
  phaseId: string,
  activityProfileId: string,
  isEnabled: boolean,
): Promise<void> {
  await db.transaction('rw', [db.phaseProfileSettings], async () => {
    const existing = await db.phaseProfileSettings
      .where('[phaseId+activityProfileId]')
      .equals([phaseId, activityProfileId])
      .first();
    if (existing && existing.deletedAt === null) {
      await db.phaseProfileSettings.put(markUpdated({ ...existing, isEnabled }));
    } else {
      await db.phaseProfileSettings.add(
        createPhaseProfileSetting(phaseId, activityProfileId, isEnabled),
      );
    }
  });
}
