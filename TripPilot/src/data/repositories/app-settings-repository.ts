import { db } from '@/data/db/database';
import { APP_SETTINGS_ID, createDefaultAppSettings } from '@/data/db/seed';
import type { AppSettings } from '@/domain/types/app-settings';

class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) {
      // Fallback for DBs created before the populate hook (GAP-031).
      const defaults = createDefaultAppSettings();
      await db.appSettings.add(defaults);
      return defaults;
    }
    // DEC-119/DEC-124: records created before these non-indexed fields
    // existed are backfilled in memory (no migration needed).
    return {
      ...settings,
      hiddenDashboardCards: settings.hiddenDashboardCards ?? [],
      dashboardCardOrder: settings.dashboardCardOrder ?? [],
      outingNotificationEnabled: settings.outingNotificationEnabled ?? true,
    };
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await db.appSettings.put(updated);
    return updated;
  }

  async reset(): Promise<AppSettings> {
    const defaults = createDefaultAppSettings();
    await db.appSettings.put(defaults);
    return defaults;
  }
}

export const appSettingsRepository = new AppSettingsRepository();
