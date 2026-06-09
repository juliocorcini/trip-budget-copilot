import { createSyncMetadata } from '@/utils/entity-factory';
import { DEFAULT_QUICK_ADD_VALUES_CENTS } from '@/domain/outing';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Device } from '@/domain/types/device';

export const APP_SETTINGS_ID = 'app-settings';

export function createDefaultAppSettings(): AppSettings {
  return {
    id: APP_SETTINGS_ID,
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
}

export function createCurrentDevice(): Device {
  return {
    ...createSyncMetadata(),
    name: 'Meu dispositivo',
    lastSeenAt: new Date().toISOString(),
  };
}
