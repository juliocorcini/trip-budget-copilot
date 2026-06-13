import type { AlertTone, AppMode, ThemePreference } from './common';

export interface AppSettings {
  id: string;
  activeTrip: string | null;
  /** E1 (M15): simple/complete UX mode (non-indexed — no migration). */
  appMode: AppMode;
  /** E1 (M22): true once the adaptive "unlock complete mode" offer was
   * accepted or dismissed — so it never nags again (non-indexed). */
  simpleRevealDismissed: boolean;
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
