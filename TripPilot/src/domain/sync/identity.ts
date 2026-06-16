import { z } from 'zod';

/** DEC-105: account-less identity — actorId is the per-install device id. */
export interface ActorIdentity {
  actorId: string;
  displayName: string;
}

export const identityQrSchema = z.object({
  v: z.literal(1),
  kind: z.literal('identity'),
  actorId: z.string().uuid(),
  name: z.string().min(1).max(60),
  /** FIELD item 8: the device's ECDH P-256 public key (base64url raw). Optional
   * so QRs from installs predating the mailbox still pair (they just can't
   * receive async messages until they re-share). */
  pk: z.string().min(1).max(200).optional(),
});

export type IdentityQrPayload = z.infer<typeof identityQrSchema>;

export function buildIdentityQrPayload(
  identity: ActorIdentity,
  publicKey?: string | null,
): IdentityQrPayload {
  return {
    v: 1,
    kind: 'identity',
    actorId: identity.actorId,
    name: identity.displayName.trim().slice(0, 60),
    ...(publicKey ? { pk: publicKey } : {}),
  };
}

export function parseIdentityQrPayload(raw: unknown): IdentityQrPayload | null {
  const result = identityQrSchema.safeParse(raw);
  return result.success ? result.data : null;
}
