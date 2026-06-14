import { createSyncMetadata } from '@/utils/entity-factory';
import { DEFAULT_QUICK_ADD_VALUES_CENTS } from '@/domain/outing';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Device } from '@/domain/types/device';

export const APP_SETTINGS_ID = 'app-settings';

export function createDefaultAppSettings(): AppSettings {
  return {
    id: APP_SETTINGS_ID,
    activeTrip: null,
    // E1 (M15): safe default — full app until the user opts into simple.
    appMode: 'complete',
    // E1 (M22): adaptive unlock offer not yet shown.
    simpleRevealDismissed: false,
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
    // DEC-119 (R-10): configurable home screen defaults.
    hiddenDashboardCards: [],
    dashboardCardOrder: [],
    // DEC-124 (R-11 v2): outing notification opt-out lives in Settings.
    outingNotificationEnabled: true,
    // DEC-128: mental currency anchor — off until the traveler sets a rate.
    anchorCurrency: null,
    anchorRatePer1: null,
    // M7: no check-in until the traveler taps one for the day.
    dailyCheckIn: null,
    // M9: no phase leftover handled yet.
    phaseLeftoverHandled: [],
    // M14: no savings goal until the traveler sets one.
    savingsGoalCents: null,
    // M19: no value suggestions dismissed yet.
    valueSuggestionsDismissed: [],
    // M22: no saved trip templates yet.
    tripTemplates: [],
    // M21: no end-of-trip priors offer handled yet.
    tripPriorsHandled: [],
    // E8 (M2): location capture is opt-in — off until the traveler enables it.
    locationCaptureEnabled: false,
    // E8 (M3): no remembered place until the first located expense.
    currentPlace: null,
    // E9 (M11): no frozen exchange rates until the traveler pulls them once.
    frozenRates: null,
  };
}

export function createCurrentDevice(): Device {
  return {
    ...createSyncMetadata(),
    name: 'Meu dispositivo',
    lastSeenAt: new Date().toISOString(),
  };
}
