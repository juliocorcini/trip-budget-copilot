/**
 * DEC-366 (wave 2026-06-27, G5 — HEADLINE) — canonical P2P delivery routing.
 *
 * The headline decision: when you settle / charge / split with a person, HOW does
 * the obligation reach them? This is pure and data-driven (no IO, no React) — the
 * UI calls it to pick the channel, and `settle-flows` owns the rule.
 *
 *  - A CONNECTED peer (holds a PeerLink publicKey, DEC-344) who owes me a net
 *    amount ⇒ a real-time accept-first `debt` (Flow A/C): it lands in their
 *    notification center + home + Acerto + profile and they accept on their own
 *    phone. No manual link needed.
 *  - A NON-connected person ⇒ a public link/QR (Flow B): the only channel we can
 *    reach them on, since we cannot seal to a key we do not have.
 *  - A connected peer who owes nothing (net ≤ 0) ⇒ nothing to deliver as a pending
 *    action (an informative extract is Flow F — secondary, never a fake debt).
 *
 * A `debt` strictly means "you owe me X": the direction is never inverted here, so
 * a zero/negative net never becomes a debt (that would misrepresent who owes whom).
 * Money stays in integer cents — the settle math is invariant in this wave.
 */

export type P2pDeliveryChannel = 'debt' | 'link' | 'none';

export interface P2pDeliveryInput {
  /** The peer has a PeerLink with a publicKey (DEC-344 connected). */
  hasPublicKey: boolean;
  /** Net the peer owes me, in cents (positive = they owe me; ≤ 0 = nothing to charge). */
  netCents: number;
}

export interface P2pDeliveryDecision {
  channel: P2pDeliveryChannel;
  /** Amount (cents) to seal as a debt when `channel === 'debt'`; 0 otherwise. */
  debtAmountCents: number;
}

/**
 * Picks the delivery channel for a P2P settlement with one person. See the module
 * header for the rule. Total over every input (never throws).
 */
export function resolveP2pDelivery(input: P2pDeliveryInput): P2pDeliveryDecision {
  if (input.hasPublicKey) {
    if (input.netCents > 0) return { channel: 'debt', debtAmountCents: input.netCents };
    return { channel: 'none', debtAmountCents: 0 };
  }
  return { channel: 'link', debtAmountCents: 0 };
}

/** True only when a connected peer can receive a real-time accept-first debt now. */
export function canDeliverDebt(input: P2pDeliveryInput): boolean {
  return resolveP2pDelivery(input).channel === 'debt';
}

/**
 * Settlement-surface adapter (the foot-gun guard). `ParticipantStatement.netCents`
 * is signed the OTHER way around — "negative = the peer owes ME" — so passing it raw
 * into `resolveP2pDelivery` would invert who owes whom (charging a person I owe).
 * This flips the sign once, in one tested place, so the UI can never get it wrong.
 */
export function resolveSettlementDelivery(input: {
  hasPublicKey: boolean;
  statementNetCents: number;
}): P2pDeliveryDecision {
  return resolveP2pDelivery({
    hasPublicKey: input.hasPublicKey,
    netCents: -input.statementNetCents,
  });
}
