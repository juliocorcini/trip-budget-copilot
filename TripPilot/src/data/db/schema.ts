export const SCHEMA_VERSION = 6;

export const SCHEMA_V1: Record<string, string> = {
  trips: 'id, name, baseCurrency, status, startDate, endDate, deletedAt',
  phases: 'id, tripId, name, startDate, endDate, order, deletedAt',
  budgetPools: 'id, tripId, name, scope, currency, deletedAt',
  budgetPoolPhaseLinks: 'id, budgetPoolId, phaseId, deletedAt',
  envelopes: 'id, budgetPoolId, kind, deletedAt',
  activityProfiles: 'id, tripId, category, isCustom, deletedAt',
  scenarioPlans: 'id, tripId, phaseId, budgetPoolId, isActive, deletedAt',
  scenarioAllocationItems: 'id, scenarioPlanId, activityProfileId, deletedAt',
  plannedOccurrences: 'id, tripId, phaseId, activityProfileId, budgetPoolId, plannedDate, deletedAt',
  participants: 'id, tripId, isOwner, deletedAt',
  wallets: 'id, tripId, walletType, isDefault, deletedAt',
  transactions: 'id, tripId, phaseId, budgetPoolId, walletId, sessionId, type, category, date, isShared, paidByParticipantId, deletedAt',
  participantShares: 'id, transactionId, participantId, deletedAt',
  sessions: 'id, tripId, phaseId, budgetPoolId, activityProfileId, status, deletedAt',
  sessionItems: 'id, sessionId, transactionId, deletedAt',
  settlements: 'id, tripId, debtorParticipantId, creditorParticipantId, deletedAt',
  forecastSnapshots: 'id, tripId, phaseId, snapshotDate, deletedAt',
  futurePhaseReservePolicies: 'id, budgetPoolId, phaseId, deletedAt',
  alertRules: 'id, tripId, alertType, isEnabled, deletedAt',
  appSettings: 'id',
  devices: 'id, deletedAt',
};

// V2 adds the compound indexes specified in database-schema.md (GAP-031).
export const SCHEMA_V2: Record<string, string> = {
  ...SCHEMA_V1,
  phases: `${SCHEMA_V1.phases}, [tripId+order]`,
  budgetPoolPhaseLinks: `${SCHEMA_V1.budgetPoolPhaseLinks}, [budgetPoolId+phaseId]`,
  envelopes: `${SCHEMA_V1.envelopes}, [budgetPoolId+kind]`,
  scenarioPlans: `${SCHEMA_V1.scenarioPlans}, [phaseId+budgetPoolId]`,
  transactions: `${SCHEMA_V1.transactions}, [phaseId+type], [phaseId+category], [budgetPoolId+type], [tripId+date]`,
  futurePhaseReservePolicies: `${SCHEMA_V1.futurePhaseReservePolicies}, [budgetPoolId+phaseId]`,
};

// V3 (R2 unified migration — DEC-071/072/074/075):
// - new phaseProfileSettings table (activities enabled per phase)
// - plannedOccurrences indexed by [phaseId+plannedDate] (day card query)
// Non-indexed fields (confirmationStatus, rhythmPreset, peakDays, endDate,
// kind, reservedCents, linkedSessionId) require no schema string changes —
// the upgrade() callback populates their defaults.
export const SCHEMA_V3: Record<string, string> = {
  ...SCHEMA_V2,
  phaseProfileSettings: 'id, phaseId, activityProfileId, deletedAt, [phaseId+activityProfileId]',
  plannedOccurrences: `${SCHEMA_V1.plannedOccurrences}, [phaseId+plannedDate]`,
};

// V4 (R4 P2P sync — DEC-105/106): peer pairing + mirrored statements.
// Participant.linkedActorId is NOT indexed, so it needs no schema string —
// the upgrade() callback fills the default.
export const SCHEMA_V4: Record<string, string> = {
  ...SCHEMA_V3,
  peerLinks: 'id, actorId, participantId, deletedAt',
  mirroredStatements: 'id, peerActorId, deletedAt',
};

// V5 (E6 — M14): local-only daily restore points ("restore to yesterday").
// Adding a brand-new table requires no upgrade() callback — Dexie creates it on
// open and leaves every existing table/row untouched. This table is LOCAL-only
// and never participates in BackupData (it is not in BACKUP_TABLE_KEYS).
export const SCHEMA_V5: Record<string, string> = {
  ...SCHEMA_V4,
  localSnapshots: 'id, createdAt',
};

// V6 (DEC-175 — Planned Purchases): a brand-new table for intended future
// purchases ("Planejados / Vou gastar"). Adding a new table needs no upgrade()
// callback — Dexie creates it on open and leaves every existing table/row
// untouched. Indexed by tripId (list query) and budgetPoolId (reserve sum).
export const SCHEMA_V6: Record<string, string> = {
  ...SCHEMA_V5,
  plannedPurchases: 'id, tripId, budgetPoolId, status, deletedAt',
};
