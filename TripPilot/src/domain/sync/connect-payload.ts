import { z } from 'zod';

/**
 * DEC-344 (G6) — the reverse half of a two-way connection. Pairing is one-way:
 * the scanner reads the peer's identity QR and writes only ITS OWN `peerLink`.
 * To make both devices appear on each other's phones WITHOUT a second scan, the
 * scanner seals this `connect` payload (carrying its own identity + public key)
 * into a mailbox envelope addressed to the peer. The peer drains it and upserts
 * the reverse `peerLink` — true two-way, once, then everything rides the mailbox.
 *
 * Authenticity (council C3 / Critic): the envelope is E2E-sealed for the peer's
 * scanned public key (only the peer can open it), and the sender's `pk` here lets
 * the peer reply async. The Worker only ever sees opaque ciphertext.
 */
export const connectPayloadSchema = z.object({
  /** The sender's device id (becomes the reverse peerLink's actorId). */
  actorId: z.string().uuid(),
  /** The sender's display name (what the peer sees in their connections). */
  name: z.string().min(1).max(60),
  /** The sender's ECDH P-256 public key (base64url raw) — so the peer can seal back. */
  pk: z.string().min(1).max(200),
});

export type ConnectPayload = z.infer<typeof connectPayloadSchema>;

export function buildConnectPayload(input: { actorId: string; name: string; pk: string }): ConnectPayload {
  return {
    actorId: input.actorId,
    name: input.name.trim().slice(0, 60),
    pk: input.pk,
  };
}

export function parseConnectPayload(raw: unknown): ConnectPayload | null {
  const result = connectPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
