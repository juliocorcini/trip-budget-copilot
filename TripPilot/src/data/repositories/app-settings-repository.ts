import { db } from '@/data/db/database';
import { APP_SETTINGS_ID, createDefaultAppSettings } from '@/data/db/seed';
import type { AppSettings } from '@/domain/types/app-settings';

class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) {
      // BUG-003: NEVER persist a default `activeTrip:null` row here. The
      // missing row can mean a fresh DB OR a real DB whose settings row was
      // evicted/lost (iOS WebKit, SW-created DB) while trips survive on disk.
      // Persisting null would orphan those trips. Return a transient default
      // (read-only) and let the boot recovery flow (BootGate) decide based on
      // an actual trip count. Persistence only happens through `update()`
      // after onboarding/import/recovery, or the Dexie `populate` hook.
      return createDefaultAppSettings();
    }
    // DEC-119/DEC-124/DEC-128: records created before these non-indexed
    // fields existed are backfilled in memory (no migration needed).
    return {
      ...settings,
      // M15: backups/records predating appMode default to the full app.
      appMode: settings.appMode ?? 'complete',
      // M22: predating records have never seen the unlock offer.
      simpleRevealDismissed: settings.simpleRevealDismissed ?? false,
      hiddenDashboardCards: settings.hiddenDashboardCards ?? [],
      dashboardCardOrder: settings.dashboardCardOrder ?? [],
      outingNotificationEnabled: settings.outingNotificationEnabled ?? true,
      anchorCurrency: settings.anchorCurrency ?? null,
      anchorRatePer1: settings.anchorRatePer1 ?? null,
      // M7: records predating the daily check-in have none.
      dailyCheckIn: settings.dailyCheckIn ?? null,
      // M9: records predating the phase-cycle have nothing handled yet.
      phaseLeftoverHandled: settings.phaseLeftoverHandled ?? [],
      // M14: records predating the savings goal have none.
      savingsGoalCents: settings.savingsGoalCents ?? null,
      // M19: records predating in-trip suggestions have nothing dismissed.
      valueSuggestionsDismissed: settings.valueSuggestionsDismissed ?? [],
    };
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    // BUG-003: it must be IMPOSSIBLE to persist `activeTrip:null` while real
    // trips still exist on disk. A null result here (either an explicit
    // null payload or a transient default from a lost settings row) is
    // self-healed to the existing trip instead of being written as null.
    if (updated.activeTrip == null) {
      const recovered = await this.findRecoverableTripId();
      if (recovered) {
        console.warn(
          '[appSettings] refused to persist activeTrip:null while trips exist — recovered to',
          recovered,
        );
        updated.activeTrip = recovered;
      }
    }
    await db.appSettings.put(updated);
    return updated;
  }

  /**
   * BUG-003: finds a trip to fall back to when the active trip is missing —
   * prefers the active-status trip, otherwise the first surviving trip.
   * Returns null only when the DB genuinely has no trips.
   */
  private async findRecoverableTripId(): Promise<string | null> {
    try {
      const active = await db.trips
        .where('status')
        .equals('active')
        .filter((trip) => trip.deletedAt === null)
        .first();
      if (active) return active.id;
      const any = await db.trips.filter((trip) => trip.deletedAt === null).first();
      return any?.id ?? null;
    } catch {
      return null;
    }
  }

  async reset(): Promise<AppSettings> {
    const defaults = createDefaultAppSettings();
    await db.appSettings.put(defaults);
    return defaults;
  }
}

export const appSettingsRepository = new AppSettingsRepository();
