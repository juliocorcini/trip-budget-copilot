import { z } from 'zod';
import { addParticipant, claimItem } from './split';
import type { SplitSession } from './types';

/**
 * G2 (live table link) — the guest → owner channel. A guest posts a SNAPSHOT of
 * everything they currently claim (not incremental ops), so a lost ping or a
 * reconnect self-heals: the latest snapshot per guest is the truth. Each batch
 * is encrypted with the link's AES key and appended to the share's `/responses`
 * slot; the owner pulls them and folds them into the live session.
 *
 * Owner-authoritative (the DEC-106 discipline applied to claiming): a guest
 * batch can ONLY (re)write the claims of its own ad-hoc participant. It can never
 * touch the owner's slice or another guest's claims — the reducer enforces this.
 */

const claimSnapshotItemSchema = z.object({
  itemId: z.string(),
  /** Portion of the whole line (0..1). Ignored when `units` is present. */
  fraction: z.number().min(0).max(1),
  /** For qty>1 lines: how many units this guest takes (null → use fraction). */
  units: z.number().int().nonnegative().nullable(),
});

export const splitClaimResponseSchema = z.object({
  v: z.literal(1),
  /** The guest's ephemeral per-share identity (stable across their reconnects). */
  fromActorId: z.string().min(1).max(64),
  fromName: z.string().min(1).max(60),
  claims: z.array(claimSnapshotItemSchema),
  at: z.string(),
});

export type SplitClaimSnapshotItem = z.infer<typeof claimSnapshotItemSchema>;
export type SplitClaimResponse = z.infer<typeof splitClaimResponseSchema>;

export interface BuildSplitClaimResponseInput {
  fromActorId: string;
  fromName: string;
  claims: SplitClaimSnapshotItem[];
}

export function buildSplitClaimResponse(input: BuildSplitClaimResponseInput): SplitClaimResponse {
  return {
    v: 1,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60) || 'Convidado',
    claims: input.claims,
    at: new Date().toISOString(),
  };
}

export function parseSplitClaimResponse(raw: unknown): SplitClaimResponse | null {
  const result = splitClaimResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Remove every claim a participant holds across all lines (immutably). */
function clearParticipantClaims(session: SplitSession, participantId: string): SplitSession {
  return {
    ...session,
    items: session.items.map((item) => ({
      ...item,
      claims: item.claims.filter((c) => c.participantId !== participantId),
    })),
  };
}

/** Apply one guest's snapshot: clear their old claims, then set the new set. */
function applyGuestSnapshot(
  session: SplitSession,
  participantId: string,
  claims: SplitClaimSnapshotItem[],
): SplitSession {
  let next = clearParticipantClaims(session, participantId);
  for (const claim of claims) {
    const share = claim.units !== null ? { units: claim.units } : { fraction: claim.fraction };
    next = claimItem(next, claim.itemId, participantId, share);
  }
  return next;
}

/**
 * Owner-reducer — fold pulled guest batches into the live session. The latest
 * snapshot per guest wins (a guest re-posts their full current selection), so
 * the result is order-stable and idempotent. For each guest:
 *  - link by `fromActorId` (a returning guest re-uses their participant, E7) or
 *    append a new ad-hoc participant (promotion to a real Participant is G3/T5);
 *  - **never** rewrite the owner's slice — a batch resolving to the owner is
 *    dropped (defends against a guest spoofing the owner's actorId);
 *  - a `markedPaid` guest is edit-locked (E10) — their snapshot is ignored.
 * Pure: returns a new session; the live panel recomputes totals/orphans from it.
 */
export function reduceGuestClaims(session: SplitSession, batches: SplitClaimResponse[]): SplitSession {
  const latestByActor = new Map<string, SplitClaimResponse>();
  for (const batch of [...batches].sort((a, b) => a.at.localeCompare(b.at))) {
    latestByActor.set(batch.fromActorId, batch);
  }

  let next = session;
  for (const batch of latestByActor.values()) {
    const added = addParticipant(next, batch.fromName, { kind: 'adhoc', actorId: batch.fromActorId });
    next = added.session;
    const participant = added.participant;
    // Owner-authoritative: the owner's claims are never set through /responses.
    if (participant.kind === 'owner') continue;
    // E10: a paid/confirmed guest's slice is frozen.
    if (participant.markedPaid) continue;
    next = applyGuestSnapshot(next, participant.id, batch.claims);
  }
  return next;
}
