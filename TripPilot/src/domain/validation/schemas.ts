import { z } from 'zod';

const syncMetadataSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  revision: z.number().int().positive(),
  sourceDeviceId: z.string().uuid(),
});

export const tripSchema = syncMetadataSchema.extend({
  name: z.string().min(1).max(100),
  baseCurrency: z.string().length(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['planning', 'active', 'completed']),
  notes: z.string().nullable(),
});

export const phaseSchema = syncMetadataSchema.extend({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z.number().int().min(0),
  // DEC-075 (v3): defaults keep v2 backups importable (uniform rhythm).
  rhythmPreset: z.enum(['intense', 'moderate', 'relaxed', 'custom']).nullable().default(null),
  peakDays: z.array(z.number().int().min(0).max(6)).nullable().default(null),
  notes: z.string().nullable(),
});

export const budgetPoolSchema = syncMetadataSchema.extend({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  scope: z.enum(['global', 'linked_phases']),
  totalAmountCents: z.number().int().min(0),
  currency: z.string().length(3),
  notes: z.string().nullable(),
});

export const budgetPoolPhaseLinkSchema = syncMetadataSchema.extend({
  budgetPoolId: z.string().uuid(),
  phaseId: z.string().uuid(),
  futureFloorCents: z.number().int().min(0).nullable(),
});

export const envelopeSchema = syncMetadataSchema.extend({
  budgetPoolId: z.string().uuid(),
  kind: z.enum(['protected_reserve', 'allocation']),
  name: z.string().min(1).max(100),
  amountCents: z.number().int().min(0),
  notes: z.string().nullable(),
});

export const participantSchema = syncMetadataSchema.extend({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  nickname: z.string().max(50).nullable(),
  isOwner: z.boolean(),
  email: z.string().email().nullable(),
  linkedUserAccountId: z.string().uuid().nullable(),
  // DEC-105 (R4): default keeps pre-v4 backups importable.
  linkedActorId: z.string().uuid().nullable().default(null),
});

export const walletSchema = syncMetadataSchema.extend({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  walletType: z.enum(['debit_card', 'credit_card', 'cash', 'digital', 'other']),
  currency: z.string().length(3),
  initialBalanceCents: z.number().int().min(0),
  isDefault: z.boolean(),
  notes: z.string().nullable(),
});

export const transactionSchema = syncMetadataSchema.extend({
  tripId: z.string().uuid(),
  phaseId: z.string().uuid(),
  budgetPoolId: z.string().uuid().nullable(),
  walletId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  type: z.enum(['expense', 'transfer', 'settlement', 'adjustment']),
  amountCents: z.number().int(),
  personalCostCents: z.number().int().nullable(),
  currency: z.string().length(3),
  baseCurrencyAmountCents: z.number().int(),
  exchangeRate: z.number().positive().nullable(),
  category: z.string().nullable(),
  // DEC-095 (R-13): added in v0.4.0 — default keeps older backups valid.
  subcategoryId: z.string().nullable().default(null),
  description: z.string().min(1),
  date: z.string(),
  isShared: z.boolean(),
  paidByParticipantId: z.string().uuid().nullable(),
  activityProfileId: z.string().uuid().nullable(),
  isSpecialOccasion: z.boolean(),
  excludeFromLearning: z.boolean(),
  sourceWalletId: z.string().uuid().nullable(),
  targetWalletId: z.string().uuid().nullable(),
  settlementId: z.string().uuid().nullable(),
  adjustmentReason: z.string().nullable(),
  notes: z.string().nullable(),
});

/**
 * Backup file validation (GAP-029). Core entities are validated against
 * their full schemas; remaining tables are validated structurally via
 * SyncMetadata. `.passthrough()` keeps unknown fields so newer-format
 * backups survive a round-trip through an older app version.
 */
const syncedRecordSchema = syncMetadataSchema.passthrough();

export const backupFileSchema = z.object({
  version: z.number().int().positive(),
  exportedAt: z.string().min(1),
  deviceId: z.string().min(1),
  appSettings: z.object({ id: z.string().min(1) }).passthrough(),
  trips: z.array(tripSchema.passthrough()).default([]),
  phases: z.array(phaseSchema.passthrough()).default([]),
  budgetPools: z.array(budgetPoolSchema.passthrough()).default([]),
  budgetPoolPhaseLinks: z.array(budgetPoolPhaseLinkSchema.passthrough()).default([]),
  envelopes: z.array(envelopeSchema.passthrough()).default([]),
  participants: z.array(participantSchema.passthrough()).default([]),
  wallets: z.array(walletSchema.passthrough()).default([]),
  transactions: z.array(transactionSchema.passthrough()).default([]),
  participantShares: z.array(syncedRecordSchema).default([]),
  activityProfiles: z.array(syncedRecordSchema).default([]),
  sessions: z.array(syncedRecordSchema).default([]),
  sessionItems: z.array(syncedRecordSchema).default([]),
  settlements: z.array(syncedRecordSchema).default([]),
  scenarioPlans: z.array(syncedRecordSchema).default([]),
  scenarioAllocationItems: z.array(syncedRecordSchema).default([]),
  plannedOccurrences: z.array(syncedRecordSchema).default([]),
  phaseProfileSettings: z.array(syncedRecordSchema).default([]),
  forecastSnapshots: z.array(syncedRecordSchema).default([]),
  futurePhaseReservePolicies: z.array(syncedRecordSchema).default([]),
  alertRules: z.array(syncedRecordSchema).default([]),
  devices: z.array(syncedRecordSchema).default([]),
});

export const createTripInputSchema = z.object({
  name: z.string().min(1).max(100),
  baseCurrency: z.string().length(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().optional(),
});

export const createPhaseInputSchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

export const createExpenseInputSchema = z.object({
  tripId: z.string().uuid(),
  phaseId: z.string().uuid(),
  budgetPoolId: z.string().uuid(),
  walletId: z.string().uuid().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  category: z.string().min(1),
  description: z.string().min(1),
  date: z.string().optional(),
  isShared: z.boolean().optional(),
  paidByParticipantId: z.string().uuid().nullable().optional(),
  activityProfileId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createWalletInputSchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(100),
  walletType: z.enum(['debit_card', 'credit_card', 'cash', 'digital', 'other']),
  currency: z.string().length(3),
  initialBalanceCents: z.number().int().min(0),
  isDefault: z.boolean(),
  notes: z.string().nullable().optional(),
});

export type CreateTripInput = z.infer<typeof createTripInputSchema>;
export type CreatePhaseInput = z.infer<typeof createPhaseInputSchema>;
export type CreateExpenseInputValidated = z.infer<typeof createExpenseInputSchema>;
export type CreateWalletInput = z.infer<typeof createWalletInputSchema>;
