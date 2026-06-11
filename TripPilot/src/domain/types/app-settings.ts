import type { AlertTone, ThemePreference } from './common';

export interface AppSettings {
  id: string;
  activeTrip: string | null;
  alertTone: AlertTone;
  defaultCurrency: string;
  themePreference: ThemePreference;
  language: string;
  vibrationEnabled: boolean;
  backupReminderEnabled: boolean;
  backupReminderDays: number;
  lastBackupDate: string | null;
  deviceName: string;
  persistentStorageGranted: boolean;
  isDemo: boolean;
  onboardingCompleted: boolean;
  quickAddDefaultValuesCents: number[];
  /** DEC-119 (R-10): configurable home screen (non-indexed — no migration). */
  hiddenDashboardCards: string[];
  dashboardCardOrder: string[];
}
