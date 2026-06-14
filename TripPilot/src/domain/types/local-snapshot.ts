/**
 * E6 (M14): a local-only daily restore point. NOT a SyncMetadata entity and
 * NEVER part of BackupData — this history exists purely so the user can
 * "restore to yesterday" on this device. The full backup payload is stored as
 * a serialized JSON string (`json`); `expenseCount` is denormalized so the
 * restore list can be rendered without re-parsing every payload.
 */
export interface LocalSnapshot {
  /** Local day key (YYYY-MM-DD) — one restore point per day. */
  id: string;
  /** ISO timestamp of when this restore point was captured. */
  createdAt: string;
  /** Number of transactions in the payload (shown in the restore list). */
  expenseCount: number;
  /** Serialized BackupData (the full DB at capture time). */
  json: string;
}
