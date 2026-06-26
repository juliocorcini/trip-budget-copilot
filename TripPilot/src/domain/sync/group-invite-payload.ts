import { z } from 'zod';

/**
 * F24 / DEC-355 (G8) — a peer invites you to a group split they created.
 *
 * Unlike `debt`/`payment` (which fold into a ledger on accept), a `group_invite`
 * carries the **read credentials** of the owner's live `/g/` board: the share id
 * + the AES key (the link fragment secret). Accept-first: the recipient gets a
 * notification; one-tap ACCEPT stores the credentials locally (so the group shows
 * in their list and opens the live board) — it NEVER auto-joins. The credentials
 * are the SAME capability a `/g/` link grants (read + claim a name); the
 * `writeToken` is deliberately NOT shared (the inviter stays the money authority).
 *
 * The Worker only forwards opaque ciphertext — this lives inside the sealed blob,
 * so the share id + key never reach the relay as readable metadata (DEC-207).
 */
export const groupInvitePayloadSchema = z.object({
  v: z.literal(1),
  /** The `/g/` share id (the Worker's address for the owner-published event). */
  shareId: z.string().min(1).max(120),
  /** The AES key (base64url) — the read capability, normally only in the URL fragment. */
  key: z.string().min(1).max(200),
  /** The group's display name (so the invite + the stored row read well before opening). */
  groupName: z.string().min(1).max(120),
});

export type GroupInvitePayload = z.infer<typeof groupInvitePayloadSchema>;

export function buildGroupInvitePayload(input: {
  shareId: string;
  key: string;
  groupName: string;
}): GroupInvitePayload {
  return {
    v: 1,
    shareId: input.shareId,
    key: input.key,
    groupName: input.groupName.trim().slice(0, 120) || 'Grupo',
  };
}

export function parseGroupInvitePayload(raw: unknown): GroupInvitePayload | null {
  const result = groupInvitePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
