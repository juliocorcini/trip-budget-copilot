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
export type AlertType = 'budget_threshold' | 'backup_reminder' | 'session_limit' | 'custom';

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
