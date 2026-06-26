/**
 * FIELD item 8: the encrypted async mailbox. Devices drop sealed blobs into the
 * worker addressed by the recipient's actorId; the recipient drains them on
 * open. The worker only ever stores opaque ciphertext.
 */

// DEC-344 (G6): `connect` carries a peer's identity so the recipient upserts the
// reverse peerLink — the two-way handshake. Like the others it is opaque to the
// Worker (sealed inside the ciphertext, addressed only by recipient actorId).
export type MailboxPayloadKind = 'statement' | 'backup' | 'connect';

/**
 * The plaintext carried inside a sealed mailbox blob. The sender's identity
 * lives INSIDE the ciphertext so the worker never learns who talks to whom.
 * `data` is an existing live-sync shape (StatementPayload or MigrationPayload).
 */
export interface MailboxEnvelope {
  v: 1;
  kind: MailboxPayloadKind;
  fromActorId: string;
  fromName: string;
  sentAt: string;
  data: unknown;
}

export type MailboxQueueDirection = 'out' | 'in';
export type MailboxQueueStatus = 'pending' | 'failed';

/**
 * A local-only queue row (never backed up). `out` rows hold a sealed blob
 * waiting to be posted; `in` rows hold a drained backup envelope waiting for the
 * traveler to preview and apply (statements skip the queue — they land directly
 * in the mirrored-statement surface, which is already a confirm step).
 */
export interface MailboxQueueItem {
  id: string;
  direction: MailboxQueueDirection;
  status: MailboxQueueStatus;
  kind: MailboxPayloadKind;
  createdAt: string;
  attempts: number;
  // out
  recipientActorId: string | null;
  recipientName: string | null;
  sealedBlob: string | null;
  // in
  fromActorId: string | null;
  fromName: string | null;
  envelope: MailboxEnvelope | null;
}
