import type { SyncMetadata } from './common';

/**
 * DEC-105/106: a paired TripPilot install. Created when an identity QR is
 * scanned (pairing) or when a statement arrives from a new peer.
 */
export interface PeerLink extends SyncMetadata {
  /** The peer's installation id (their `trippilot_device_id`). */
  actorId: string;
  displayName: string;
  /** Local participant this peer maps to, when paired from /shared. */
  participantId: string | null;
  lastSyncAt: string | null;
  /** FIELD item 8: the peer's ECDH P-256 public key (base64url raw), captured
   * at pairing. Enables sealing async mailbox messages for them. null for links
   * paired before mailbox support — re-pair to fill (non-indexed). */
  publicKey: string | null;
}
