import { db } from '@/data/db/database';
import { DEFAULT_QUICK_ADD_VALUES_CENTS } from '@/domain/outing';
import type { AppSettings } from '@/domain/types/app-settings';

const DEFAULT_SETTINGS_ID = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  id: DEFAULT_SETTINGS_ID,
  activeTrip: null,
  alertTone: 'amigo_sincero',
  defaultCurrency: 'EUR',
  themePreference: 'dark',
  language: 'pt-BR',
  vibrationEnabled: true,
  backupReminderEnabled: true,
  // DEC-057 (decision D-A): reminder default is 7 days.
  backupReminderDays: 7,
  lastBackupDate: null,
  deviceName: 'Meu dispositivo',
  persistentStorageGranted: false,
  isDemo: false,
  onboardingCompleted: false,
  quickAddDefaultValuesCents: DEFAULT_QUICK_ADD_VALUES_CENTS,
};

class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const settings = await db.appSettings.get(DEFAULT_SETTINGS_ID);
    if (!settings) {
      await db.appSettings.add(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return settings;
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await db.appSettings.put(updated);
    return updated;
  }

  async reset(): Promise<AppSettings> {
    await db.appSettings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}

export const appSettingsRepository = new AppSettingsRepository();
