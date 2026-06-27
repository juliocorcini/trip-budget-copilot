import { v5 as uuidv5 } from 'uuid';

/**
 * DEC-377 (wave 2026-06-27, G3) — consistent split delivery (Â-CONSISTENT-SPLIT).
 *
 * A manual "Registrar gasto" split with a CONNECTED person used to die as a local
 * `pending` share (DEC-241) that NEVER reached the peer — so the recipient saw
 * nothing and the sender read "em dia". "Dividir conta" already delivers a debt
 * (DEC-366). This pure layer closes that gap: it decides WHICH slices to deliver
 * and the exact debt params; the orchestrator performs the send by reusing
 * `shareDebtWithPeer` (the same accept-first path — no new transport, no new math).
 *
 * Rule: deliver only when the OWNER fronted the money (`payer === owner`) — only
 * then is a slice genuinely "you owe me", a debt the owner has standing to send.
 * A non-owner payer or a non-connected participant stays owner-owed locally
 * (DEC-241) and is never delivered from here. Arithmetic stays invariant: the
 * debt is born on the recipient ONLY when THEY accept; this just addresses it.
 *
 * Idempotency: each `debtId` is a DETERMINISTIC uuid (v5) of
 * (`transactionId`, `participantId`), so re-saving / redelivering the same
 * expense yields the SAME `externalRef` (`debt:<owner>:<debtId>`) and the
 * recipient dedupes — a re-save never folds a second debt.
 */

/** Fixed namespace for deterministic manual-split debt ids (any valid UUID). */
const MANUAL_SPLIT_DEBT_NAMESPACE = '3d6f0c1e-8a2b-4c5d-9e7f-1a2b3c4d5e6f';

export interface ManualSplitShare {
  participantId: string;
  shareAmountCents: number;
  deletedAt: string | null;
}

export interface ManualSplitParticipant {
  id: string;
  isOwner: boolean;
  linkedActorId: string | null;
  deletedAt: string | null;
}

export interface ManualSplitDeliveryInput {
  transactionId: string;
  ownerId: string;
  /** Who fronted the money. Delivery only happens when this is the owner. */
  payerId: string | null;
  currency: string;
  /** The expense description — rides along as the debt's provenance/reason. */
  description: string;
  occurredAt: string | null;
  shares: ManualSplitShare[];
  participants: ManualSplitParticipant[];
}

export interface ManualSplitDebtDelivery {
  peerActorId: string;
  amountCents: number;
  currency: string;
  description: string;
  occurredAt: string | null;
  /** Deterministic — re-delivering the same (expense, person) dedupes downstream. */
  debtId: string;
}

/** The stable debt id for a (manual expense, participant) pair — idempotency key. */
export function manualSplitDebtId(transactionId: string, participantId: string): string {
  return uuidv5(`${transactionId}:${participantId}`, MANUAL_SPLIT_DEBT_NAMESPACE);
}

/**
 * Decide the debts a just-saved manual split should deliver to connected peers.
 * Total + pure: no IO, deterministic. Returns [] when the owner was not the
 * payer (nothing to send "from me"), so the caller can route every result
 * straight through `shareDebtWithPeer`.
 */
export function planManualSplitDeliveries(input: ManualSplitDeliveryInput): ManualSplitDebtDelivery[] {
  // Only an owner-paid split yields "you owe me" debts the owner can send.
  if (input.payerId !== input.ownerId) return [];

  const actorByParticipant = new Map<string, string>();
  for (const participant of input.participants) {
    if (participant.deletedAt !== null) continue;
    if (participant.isOwner) continue;
    if (participant.linkedActorId) actorByParticipant.set(participant.id, participant.linkedActorId);
  }

  const deliveries: ManualSplitDebtDelivery[] = [];
  const seen = new Set<string>();
  for (const share of input.shares) {
    if (share.deletedAt !== null) continue;
    if (share.shareAmountCents <= 0) continue;
    if (share.participantId === input.ownerId) continue;
    const peerActorId = actorByParticipant.get(share.participantId);
    if (!peerActorId) continue; // not a connected device → owner-owed locally (DEC-241)
    if (seen.has(share.participantId)) continue; // one debt per person, even if split twice
    seen.add(share.participantId);
    deliveries.push({
      peerActorId,
      amountCents: share.shareAmountCents,
      currency: input.currency,
      description: input.description,
      occurredAt: input.occurredAt,
      debtId: manualSplitDebtId(input.transactionId, share.participantId),
    });
  }
  return deliveries;
}
