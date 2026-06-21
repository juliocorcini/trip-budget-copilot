import type {
  AlertTone,
  AppMode,
  CurrentPlace,
  DailyCheckIn,
  FrozenExchangeRates,
  ThemePreference,
} from './common';
import type { TripTemplate } from './trip-template';
import type { PaymentMethod } from '@/domain/payment/payment-methods';

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
  /** FIELD item 16: ids of (pairable) cards the traveler opted into the 2-up
   * grid, so two compact cards share a row. Empty = everything full width
   * (non-indexed — no migration). */
  dashboardPairedCards: string[];
  /** FIELD R2 item 5 (F5): ids of CONTEXTUAL cards the traveler pinned so they
   * always show on the home (e.g. the piggy bank, which is otherwise surfaced
   * only by the calm/no-spend check-in lens). Empty = contextual-only
   * (non-indexed — no migration). */
  dashboardPinnedCards: string[];
  /** UX polish (D3): ids of dashboard cards collapsed to a header row (closed
   * drawer). Sibling of `hiddenDashboardCards`. undefined = use the default
   * collapsed set, so existing installs also open with the analytics drawer
   * closed (non-indexed — no migration). */
  collapsedDashboardCards: string[];
  /** DEC-124 (R-11 v2): user toggle for the active-outing notification. */
  outingNotificationEnabled: boolean;
  /** DEC-128: mental anchor currency ("think in R$"). null = off. */
  anchorCurrency: string | null;
  /** DEC-128: manual offline rate — anchor units per 1 base currency unit. */
  anchorRatePer1: number | null;
  /** E5 (M7): the day's intent check-in (non-indexed — no migration). */
  dailyCheckIn: DailyCheckIn | null;
  /** E5 (M9): ids of ended phases whose leftover decision was already handled
   * (moved or dismissed) — so the sheet never reopens for the same cycle
   * (non-indexed — no migration). */
  phaseLeftoverHandled: string[];
  /** E6 (M14): target money to come home with ("save €200"); null = no goal.
   * Read-only motivation — never affects "free today" (non-indexed). */
  savingsGoalCents: number | null;
  /** E7 (M19): profile ids whose value-update suggestion the user dismissed
   * ("keep") — so the same suggestion never nags again this trip
   * (non-indexed — no migration). */
  valueSuggestionsDismissed: string[];
  /** E7 (M22): reusable trip molds (phases + learned typicals) saved from past
   * trips, applied on a new trip's onboarding. Non-indexed JSON blob — no
   * Dexie table/migration (ÂNCORA 18). */
  tripTemplates: TripTemplate[];
  /** E7 (M21): trip ids whose end-of-trip "save what you learned" offer was
   * already handled (saved or dismissed) — so it never reopens (non-indexed). */
  tripPriorsHandled: string[];
  /** E8 (M2): opt-in flag for capturing the location of each expense. Default
   * false — GPS is never read until the traveler turns this on (non-indexed,
   * privacy first — ÂNCORA 8). */
  locationCaptureEnabled: boolean;
  /** E8 (M3): the remembered current place, reused across expenses until the
   * traveler moves area or changes it. null when location is off/unknown
   * (non-indexed — no migration). */
  currentPlace: CurrentPlace | null;
  /** E9 (M11): opt-in, frozen exchange-rate snapshot used offline as the
   * default conversion when logging a foreign-currency expense. null until the
   * traveler pulls it once while online (non-indexed — no migration). */
  frozenRates: FrozenExchangeRates | null;
  /** E6 (M20): opt-in app lock. Default false — the app never asks for a PIN
   * until the traveler turns this on (non-indexed — no migration). */
  appLockEnabled: boolean;
  /** E6 (M20): PBKDF2 hash of the PIN (hex). NEVER the PIN in clear. null when
   * no PIN is set. */
  appLockPinHash: string | null;
  /** E6 (M20): random per-PIN salt (hex) used with the hash above. */
  appLockPinSalt: string | null;
  /** B6 (DEC-213): opt-in biometric unlock layered OVER the PIN. Default false.
   * Can only be on when a PIN exists; the PIN is always the fallback so the user
   * is never trapped (ÂNCORA 12; non-indexed — no migration). */
  appLockBiometricEnabled: boolean;
  /** B6 (DEC-213): WebAuthn platform credential id (base64url) bound to THIS
   * device. Device-local — useless after a restore to another device, where the
   * PIN simply takes over. null until biometrics are enabled. */
  appLockBiometricCredentialId: string | null;
  /** R3-H: the last expense category the traveler used, so QuickAdd opens on it
   * instead of always defaulting to "other" (sticky, mirrors currentPlace).
   * null until the first expense (non-indexed — no migration). */
  lastExpenseCategory: string | null;
  /** FIELD item 8: long-lived device identity for the async encrypted mailbox.
   * The keypair is EXTRACTABLE (JWK) so it travels inside the backup — restoring
   * keeps the pairing (user choice). null until first use (non-indexed). */
  deviceIdentity: DeviceIdentity | null;
  /** FIELD item 8: when on, the app drains its mailbox from the worker on open.
   * Default true (user choice "ligado por padrão"). Toggle in Settings to stop
   * contacting the worker (non-indexed — no migration). */
  mailboxEnabled: boolean;
  /** DEC-206 (G2): opt-in to read receipts with cloud AI. Default FALSE — the
   * receipt photo only leaves the device after explicit consent (the image is
   * sent to the Worker /ocr proxy → Groq, which does not train on it). Privacy
   * first, like locationCaptureEnabled (ÂNCORA 8; non-indexed — no migration). */
  cloudReceiptOcrEnabled: boolean;
  /** DEC-246 (AI Quick Entry): master switch for the natural-language quick-entry
   * box (text + voice → router). When on, the typed/spoken text and a tiny
   * names-only context pack are sent to the Worker /assistant proxy → Groq; the
   * device resolves and executes locally. Default ON for the app owner (the
   * headline low-friction tool); the toggle disables it and the feature degrades
   * to manual entry when the key/network is absent (non-indexed — no migration). */
  aiQuickEntryEnabled: boolean;
  /** DEC-246: privacy mode — when true, the context pack withholds people and
   * wallet NAMES (the device then always asks "who?" on a name). Default false
   * (names help the router); cautious users can turn it on (non-indexed). */
  aiQuickEntryPrivateNames: boolean;
  /** GATE 5 (D10): manual override for progressive wallet tracking. `null` =
   * AUTOMATIC (the wallet question lights up only with 2+ wallets or a Wise
   * import); `true` = always ask "de onde saiu?"; `false` = never ask. Default
   * null keeps the wallet invisible for a single-source traveler (non-indexed
   * — no migration). */
  walletTrackingOverride: boolean | null;
  /** G4 (DEC-244): user-defined repayment methods (a Pix key, a Wise tag, bank
   * details or free text) the owner chooses to publish. The enabled ones are
   * appended to the "Lembrar/Cobrar" message. Empty by default — the reminder
   * stays exactly as before until the user adds one (non-indexed, no migration;
   * travels inside the backup like the rest of AppSettings). */
  paymentMethods: PaymentMethod[];
  /** DEC-248 (Admin dashboard): opt-out master switch for anonymous-by-install
   * usage telemetry. Default TRUE (on-by-default, Julio's call). When on, the
   * app sends — at most once per day, on open — a heartbeat with the owner's
   * display NAME and NON-MONETARY usage counts/flags (never values, items,
   * balances or transaction content) to the Worker /t endpoint. Turning it off
   * stops every telemetry network call (non-indexed — no migration). */
  telemetryEnabled: boolean;
}

/**
 * FIELD item 8: account-less device identity for the end-to-end encrypted
 * mailbox. `actorId` matches the install id; the ECDH P-256 keypair (stored as
 * JWK) seals/opens messages — the worker only ever sees ciphertext.
 */
export interface DeviceIdentity {
  actorId: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}
