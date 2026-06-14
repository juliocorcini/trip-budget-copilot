export interface SyncMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
  sourceDeviceId: string;
}

export type TripStatus = 'planning' | 'active' | 'completed';
export type BudgetPoolScope = 'global' | 'linked_phases';
export type EnvelopeKind = 'protected_reserve' | 'allocation';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ScenarioPreset = 'economico' | 'equilibrado' | 'mais_social' | 'personalizado';
export type ScenarioMode = 'manual' | 'assisted';
export type AllocationPriority = 'essential' | 'planned' | 'optional';
export type WalletType = 'debit_card' | 'credit_card' | 'cash' | 'digital' | 'other';
export type TransactionType = 'expense' | 'transfer' | 'settlement' | 'adjustment';
export type ShareType = 'equal' | 'custom';
export type SessionStatus = 'active' | 'completed' | 'cancelled';
export type AlertTone = 'amigo_sincero' | 'calmo' | 'direto';
export type ThemePreference = 'dark' | 'light' | 'system';
/**
 * E1 (M15): two-doors UX. `simple` hides advanced surfaces (never deletes
 * data — ÂNCORA 9); `complete` is the full app. Default is `complete` so any
 * record predating this field keeps every feature visible.
 */
export type AppMode = 'simple' | 'complete';
export type AlertType = 'budget_threshold' | 'backup_reminder' | 'session_limit' | 'custom';

/**
 * E5 (M7): the day's intent — a one-tap context that colors tone/budget
 * (read-only; never writes a user value — ÂNCORA 12).
 */
export type CheckInIntent = 'calm' | 'outing' | 'night';

/** E5 (M7): the active check-in, scoped to a single local date. */
export interface DailyCheckIn {
  date: string;
  intent: CheckInIntent;
}

/**
 * E8 (Phase 5, M3): the "sticky" current place. Remembered across expenses so
 * the traveler is not asked for the location on every entry — only re-asked
 * when the GPS reports a move beyond a threshold, or when they tap the name.
 * Coordinates are 100% local and never leave the device (ÂNCORA 8).
 */
export interface CurrentPlace {
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
}

export type TransactionCategory =
  | 'bar'
  | 'market'
  | 'restaurant'
  | 'outing'
  | 'transport'
  | 'festival'
  | 'accommodation'
  | 'health'
  | 'communication'
  | 'clothing'
  | 'gifts'
  | 'entertainment'
  | 'home_day'
  | 'special'
  | 'cash_adjustment'
  | 'reconciliation'
  | 'other';
