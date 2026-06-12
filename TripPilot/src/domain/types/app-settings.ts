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
  /** DEC-124 (R-11 v2): user toggle for the active-outing notification. */
  outingNotificationEnabled: boolean;
  /** DEC-128: mental anchor currency ("think in R$"). null = off. */
  anchorCurrency: string | null;
  /** DEC-128: manual offline rate — anchor units per 1 base currency unit. */
  anchorRatePer1: number | null;
}
