import { z } from 'zod';
import { imageRefSchema } from '@/domain/media';
import type { GroupExpense, GroupSplitEvent } from './types';

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

/**
 * DEC-340 — one guest-authored expense in a claim snapshot. The wire shape mirrors
 * the durable `GroupExpense` minus the owner-stamped bits (`createdAt`, `source`,
 * `authoredByActorId`), which the reducer fills on fold. The `id` is **client-stable**
 * (e.g. `g:<actorId>:<rand>`) so re-posting the same snapshot is idempotent.
 */
const groupClaimLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountCents: z.number().int(),
  qty: z.number(),
});

export const groupClaimExpenseSchema = z.object({
  id: z.string().min(1).max(120),
  description: z.string(),
  amountCents: z.number().int().positive(),
  paidByParticipantId: z.string().min(1),
  splitMode: z.enum(['equal', 'custom']),
  participantIds: z.array(z.string().min(1)).min(1),
  customAmountsCents: z.record(z.string(), z.number().int()).optional(),
  category: z.string().optional(),
  occurredAt: z.string().optional(),
  items: z.array(groupClaimLineItemSchema).optional(),
  // DEC-342/343 (legacy single) + DEC-348 (multi, plaintext) — a guest can author
  // an expense carrying receipt image(s); the reducer folds them onto the expense.
  imageRef: imageRefSchema.optional(),
  imageRefs: z.array(imageRefSchema).optional(),
});

export type GroupClaimExpense = z.infer<typeof groupClaimExpenseSchema>;

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
  /**
   * DEC-340 — the FULL set of expenses this device currently authors (a snapshot,
   * like `markedPaid`). The owner folds them add-or-retract: ids present here that
   * the owner hasn't seen are added; ids this author previously contributed that
   * are gone here are retracted. Absent/empty = this device authors nothing.
   */
  expenses: z.array(groupClaimExpenseSchema).optional(),
  at: z.string(),
});

export type GroupClaimResponse = z.infer<typeof groupClaimResponseSchema>;

export interface BuildGroupClaimResponseInput {
  fromActorId: string;
  fromName: string;
  claimedParticipantId: string;
  markedPaid: boolean;
  expenses?: GroupClaimExpense[];
}

export function buildGroupClaimResponse(input: BuildGroupClaimResponseInput): GroupClaimResponse {
  const response: GroupClaimResponse = {
    v: 1,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60) || 'Convidado',
    claimedParticipantId: input.claimedParticipantId,
    markedPaid: input.markedPaid,
    at: new Date().toISOString(),
  };
  if (input.expenses && input.expenses.length > 0) response.expenses = input.expenses;
  return response;
}

export function parseGroupClaimResponse(raw: unknown): GroupClaimResponse | null {
  const result = groupClaimResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Validate one wire expense (used to sanitise the guest's locally-stored draft). */
export function parseGroupClaimExpense(raw: unknown): GroupClaimExpense | null {
  const result = groupClaimExpenseSchema.safeParse(raw);
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
 *
 * DEC-340 — it also folds the device's authored EXPENSES with a strict
 * **add-or-retract, never-replace** contract (owner stays the money authority):
 *  - ADD an authored expense the owner has not seen (validated against the event's
 *    participants + integer cents; invalid claims are dropped to protect balances);
 *  - RETRACT an expense this author previously contributed that is gone from their
 *    snapshot (the author pulled it);
 *  - NEVER overwrite an already-folded expense from a guest snapshot, so the owner's
 *    edits win and a re-posted snapshot can't clobber them;
 *  - SKIP any id in `hiddenExpenseIds` (the owner tombstoned it — hide-never-delete).
 * Pure: returns a new event; the panel recomputes balances/transfers from it.
 */
/**
 * G3 / DEC-349 (live read-fold; AMENDS DEC-340) — the READ-side projection that
 * **every viewer** (the `/g/` guest board + any non-owner detail) renders: fold
 * all pulled response snapshots onto the owner-published `base` so a guest's
 * add / remove / retract recalculates the **total + balances for everyone**
 * WITHOUT the owner opening the app (F10), and a deletion corrects the total at
 * once (F11 — the "120€" bug). It is **exactly** the owner's `reduceGroupClaims`,
 * reused on the read side — so the projection is identical to what the owner will
 * eventually re-publish (no divergent math, ledger-math invariance holds). The
 * owner stays the **money authority + moderator**: canonical settlement still
 * uses the owner-published base, and the base's tombstones (`hiddenExpenseIds`) +
 * `confirmed` slots still win on fold. Pure + idempotent.
 */
export function foldEventForViewer(base: GroupSplitEvent, responses: GroupClaimResponse[]): GroupSplitEvent {
  return reduceGroupClaims(base, responses);
}

export function reduceGroupClaims(event: GroupSplitEvent, batches: GroupClaimResponse[]): GroupSplitEvent {
  const latestByActor = new Map<string, GroupClaimResponse>();
  for (const batch of [...batches].sort((a, b) => a.at.localeCompare(b.at))) {
    latestByActor.set(batch.fromActorId, batch);
  }

  let participants = event.participants;
  let expenses = event.expenses;
  const hidden = new Set(event.hiddenExpenseIds ?? []);
  const participantIds = new Set(event.participants.map((p) => p.id));

  for (const batch of latestByActor.values()) {
    participants = participants.map((p) => {
      // Release a stale binding: this device moved to a different slot.
      if (p.id !== batch.claimedParticipantId) {
        return p.claimedByActorId === batch.fromActorId ? { ...p, claimedByActorId: null } : p;
      }
      // The owner slot is never claimable through /responses.
      if (p.kind === 'owner') return p;
      // DEC-353 — owner DECISIONS (confirmed/contested/cancelled) are authoritative
      // and stick over a guest's self-report; only unpaid/marked follow the claim.
      const nextStatus =
        p.paymentStatus === 'confirmed' || p.paymentStatus === 'contested' || p.paymentStatus === 'cancelled'
          ? p.paymentStatus
          : batch.markedPaid
            ? 'marked'
            : 'unpaid';
      return { ...p, claimedByActorId: batch.fromActorId, paymentStatus: nextStatus };
    });

    const actor = batch.fromActorId;
    const snapshot = batch.expenses ?? [];
    const snapshotIds = new Set(snapshot.map((e) => e.id));
    // Retract: drop this author's folded expenses absent from their snapshot.
    expenses = expenses.filter((e) => !(e.authoredByActorId === actor && !snapshotIds.has(e.id)));
    // Add: fold new, valid, non-tombstoned authored expenses (never replace).
    const existingIds = new Set(expenses.map((e) => e.id));
    for (const claim of snapshot) {
      if (hidden.has(claim.id) || existingIds.has(claim.id)) continue;
      const folded = foldClaimExpense(claim, actor, batch.claimedParticipantId, participantIds);
      if (folded) {
        expenses = [...expenses, folded];
        existingIds.add(folded.id);
      }
    }
  }
  return { ...event, participants, expenses };
}

/**
 * DEC-340 — turn a wire `GroupClaimExpense` into a durable owner-stamped
 * `GroupExpense`, or `null` when it would corrupt the ledger. Guards (drop on
 * fail, never throw): the payer + every share participant must be real slots, the
 * amount is a positive integer, and any custom amounts are integers. The owner
 * stamps `createdAt`, `source: 'manual'`, the author actorId and — for the G2
 * "registered by" label — the guest's claimed slot as `createdByParticipantId`.
 */
function foldClaimExpense(
  claim: GroupClaimExpense,
  actorId: string,
  claimedParticipantId: string,
  participantIds: Set<string>,
): GroupExpense | null {
  if (!Number.isInteger(claim.amountCents) || claim.amountCents <= 0) return null;
  if (!participantIds.has(claim.paidByParticipantId)) return null;
  if (claim.participantIds.length === 0) return null;
  if (!claim.participantIds.every((id) => participantIds.has(id))) return null;

  const expense: GroupExpense = {
    id: claim.id,
    description: claim.description.trim(),
    amountCents: claim.amountCents,
    paidByParticipantId: claim.paidByParticipantId,
    splitMode: claim.splitMode,
    participantIds: [...claim.participantIds],
    customAmountsCents: claim.customAmountsCents ? { ...claim.customAmountsCents } : {},
    category: claim.category ?? 'other',
    source: 'manual',
    createdAt: new Date().toISOString(),
    authoredByActorId: actorId,
  };
  if (participantIds.has(claimedParticipantId)) expense.createdByParticipantId = claimedParticipantId;
  if (claim.occurredAt) expense.occurredAt = claim.occurredAt;
  if (claim.items && claim.items.length > 0) expense.items = claim.items.map((it) => ({ ...it }));
  if (claim.imageRef) expense.imageRef = { ...claim.imageRef };
  if (claim.imageRefs && claim.imageRefs.length > 0) expense.imageRefs = claim.imageRefs.map((r) => ({ ...r }));
  return expense;
}
