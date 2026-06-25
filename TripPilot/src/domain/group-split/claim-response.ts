import { z } from 'zod';
import type { GroupSplitEvent } from './types';

/**
 * C23 / DEC-297 (Tricount public link) — the guest → owner channel. A guest picks
 * which participant slot is them ("a pessoa escolhe o nome") and asserts whether
 * they have paid their net debt. The guest posts a SNAPSHOT of that state (not
 * incremental ops), so a lost ping or a reconnect self-heals: the latest snapshot
 * per device is the truth. Each batch is encrypted with the link's AES key and
 * appended to the share's `/responses` slot; the owner pulls them and folds them
 * into the live event.
 *
 * Owner-authoritative (DEC-106 discipline applied to a group): a guest batch can
 * only bind ITS OWN device to a slot and escalate THAT slot to `marked`. It can
 * never claim the owner's slot, never set `confirmed` (the owner alone confirms
 * receipt), and never downgrade a slot the owner already confirmed. The reducer
 * enforces all of this.
 */

export const groupClaimResponseSchema = z.object({
  v: z.literal(1),
  /** The guest's stable per-device identity (survives their reconnects). */
  fromActorId: z.string().min(1).max(64),
  /** Display name the guest shows (informational for the owner). */
  fromName: z.string().min(1).max(60),
  /** The participant slot this device says it is. */
  claimedParticipantId: z.string().min(1),
  /** The guest asserts they settled their net debt (owner still confirms). */
  markedPaid: z.boolean(),
  at: z.string(),
});

export type GroupClaimResponse = z.infer<typeof groupClaimResponseSchema>;

export interface BuildGroupClaimResponseInput {
  fromActorId: string;
  fromName: string;
  claimedParticipantId: string;
  markedPaid: boolean;
}

export function buildGroupClaimResponse(input: BuildGroupClaimResponseInput): GroupClaimResponse {
  return {
    v: 1,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60) || 'Convidado',
    claimedParticipantId: input.claimedParticipantId,
    markedPaid: input.markedPaid,
    at: new Date().toISOString(),
  };
}

export function parseGroupClaimResponse(raw: unknown): GroupClaimResponse | null {
  const result = groupClaimResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Owner-reducer — fold pulled guest batches into the live event. The latest
 * snapshot per device wins (a guest re-posts their full current state), so the
 * result is order-stable and idempotent. For each device:
 *  - release any OTHER slot this device used to hold (one device → one slot);
 *  - bind the chosen slot's `claimedByActorId` to this device;
 *  - **never** claim the owner's slot (a guest spoofing the owner is dropped);
 *  - escalate the slot to `marked` when the guest asserts paid, or back to
 *    `unpaid` when they un-assert — UNLESS the owner already set `confirmed`,
 *    which freezes the slot (only the owner can move off `confirmed`).
 * Pure: returns a new event; the panel recomputes balances/transfers from it.
 */
export function reduceGroupClaims(event: GroupSplitEvent, batches: GroupClaimResponse[]): GroupSplitEvent {
  const latestByActor = new Map<string, GroupClaimResponse>();
  for (const batch of [...batches].sort((a, b) => a.at.localeCompare(b.at))) {
    latestByActor.set(batch.fromActorId, batch);
  }

  let participants = event.participants;
  for (const batch of latestByActor.values()) {
    participants = participants.map((p) => {
      // Release a stale binding: this device moved to a different slot.
      if (p.id !== batch.claimedParticipantId) {
        return p.claimedByActorId === batch.fromActorId ? { ...p, claimedByActorId: null } : p;
      }
      // The owner slot is never claimable through /responses.
      if (p.kind === 'owner') return p;
      const nextStatus =
        p.paymentStatus === 'confirmed'
          ? 'confirmed'
          : batch.markedPaid
            ? 'marked'
            : 'unpaid';
      return { ...p, claimedByActorId: batch.fromActorId, paymentStatus: nextStatus };
    });
  }
  return { ...event, participants };
}
