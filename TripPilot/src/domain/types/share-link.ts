import type { SyncMetadata } from './common';

/**
 * DEC-207 — owner-side record of a shared participant link. LOCAL-ONLY and
 * never backed up: it holds the link's secrets (the AES `key` and the owner
 * `writeToken`), which must not leave the device inside a portable backup.
 * `id` is the server share id, so there is exactly one record per link.
 */
export interface ShareLink extends SyncMetadata {
  /** The participant whose statement this link exposes. */
  participantId: string;
  /** DEC-446 — readable path slug (absent on legacy/preview-off links).
   * Additive + optional → old rows read back `undefined`; non-indexed. */
  slug?: string | null;
  /** AES-GCM key (base64url) — encrypts the statement. */
  key: string;
  /** DEC-455 — worker escrows the key, so the built link drops `#k=`.
   * Additive + optional → old rows read back `undefined`; non-indexed. */
  keyOnServer?: boolean;
  /** Owner-only write token — gates statement update / revoke / response pull. */
  writeToken: string;
  /** Last statement revision pushed to the server (bumped on every update). */
  statementRevision: number;
  /** When the owner revoked the link (server tombstoned → guest reads expired). */
  revokedAt: string | null;
  /** Last time the owner pulled + reconciled guest responses. */
  lastPulledAt: string | null;
}
