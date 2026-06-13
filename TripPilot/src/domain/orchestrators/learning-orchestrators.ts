import { db } from '@/data/db/database';
import { markUpdated } from '@/utils/entity-factory';
import { APP_SETTINGS_ID } from '@/data/db/seed';
import { markValueSuggestionDismissed } from '@/domain/profiles';

/**
 * E7 (M19) — applying or dismissing an in-trip value suggestion. Only ACCEPT
 * writes the profile (ÂNCORA 12 / DEC-007: the app proposes, the user decides).
 * Dismiss merely records the choice so the same suggestion never nags again
 * this trip. Both paths are atomic.
 */
export interface ApplyValueSuggestionInput {
  profileId: string;
  typicalValueCents: number;
  safeValueCents: number;
}

export async function applyValueSuggestion(input: ApplyValueSuggestionInput): Promise<void> {
  await db.transaction('rw', [db.activityProfiles], async () => {
    const profile = await db.activityProfiles.get(input.profileId);
    if (!profile || profile.deletedAt !== null) return;
    await db.activityProfiles.put(
      markUpdated({
        ...profile,
        typicalValueCents: input.typicalValueCents,
        safeValueCents: input.safeValueCents,
      }),
    );
  });
}

export async function dismissValueSuggestion(profileId: string): Promise<void> {
  await db.transaction('rw', [db.appSettings], async () => {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) return;
    await db.appSettings.put({
      ...settings,
      valueSuggestionsDismissed: markValueSuggestionDismissed(
        settings.valueSuggestionsDismissed ?? [],
        profileId,
      ),
    });
  });
}
