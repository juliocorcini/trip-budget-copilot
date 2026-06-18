/**
 * "Dividir conta" (bill split) — pure domain types.
 *
 * A `SplitSession` is the single source of truth for one bill being divided. It
 * is transport-agnostic (the same entity backs the offline "pass-the-phone"
 * flow, the live table link and the hybrid mode) and persistence-agnostic (it
 * only becomes expenses/debts at commit time). All math lives in pure functions
 * over this shape, so it is exhaustively unit-testable to the cent.
 *
 * Decisions: T1–T17 in brain/documents/bill-split-implementation-support-2026-06-18.md.
 */

export type SplitParticipantKind = 'owner' | 'adhoc' | 'linked';

export interface SplitParticipant {
  /** Ephemeral uuid within the session. */
  id: string;
  name: string;
  kind: SplitParticipantKind;
  /** Set when linked to an app user (T8 — propagation target). */
  actorId: string | null;
  /** Set when promoted to a real trip Participant (T5). */
  linkedParticipantId: string | null;
  /** E10 — once paid/confirmed, their slice is edit-locked. */
  markedPaid: boolean;
}

/**
 * One participant's claim on a line. `fraction` is a portion of the WHOLE line
 * (0..1, enables half-item); `units` is an alternative for qty>1 lines (how many
 * units this person takes). Exactly one of them drives the weight — `units` wins
 * when present and the line has a positive qty.
 */
export interface SplitClaim {
  participantId: string;
  fraction: number;
  units: number | null;
}

export interface SplitItem {
  id: string;
  description: string;
  qty: number;
  unitAmountCents: number;
  /** Line total — the amount this line contributes to the bill. */
  amountCents: number;
  category: string;
  /** Empty = nobody took it yet (an orphan/sobra). */
  claims: SplitClaim[];
}

export type ServiceChargeMode = 'proportional' | 'per_head' | 'none';
export type ServiceChargeSource = 'detected' | 'inferred_included' | 'asked' | 'manual';

export interface ServiceCharge {
  mode: ServiceChargeMode;
  source: ServiceChargeSource;
  /** Absolute service amount in cents (0 when mode is none). */
  amountCents: number;
  /** When the charge is expressed as a percentage of the items subtotal. */
  percent: number | null;
}

/** E6 — non-service lines that still change what people pay. */
export type AdjustmentKind = 'couvert' | 'discount' | 'other';

export interface Adjustment {
  id: string;
  kind: AdjustmentKind;
  label: string;
  /** Negative for a discount (a credit), positive for couvert/other. */
  amountCents: number;
  /** couvert → per_head default; discount/other → proportional. */
  mode: ServiceChargeMode;
  source: ServiceChargeSource;
}

export type SplitStatus = 'draft' | 'live' | 'committed';

/** The three user-facing division modes (§10). */
export type SplitMode = 'equal' | 'itemized' | 'mine';

export interface SplitSession {
  id: string;
  tripId: string | null;
  phaseId: string | null;
  name: string;
  /** The BILL's currency; converted to trip base at commit (reuses receipt FX). */
  currency: string;
  status: SplitStatus;
  mode: SplitMode;
  serviceCharge: ServiceCharge;
  adjustments: Adjustment[];
  items: SplitItem[];
  participants: SplitParticipant[];
  /** Printed total, for reconciliation/inference (null when absent). */
  readTotalCents: number | null;
  createdAt: string;
}

export interface PerPersonLine {
  description: string;
  amountCents: number;
}

export interface PerPersonTotal {
  participantId: string;
  /** Sum of this person's claimed item slices. */
  itemsCents: number;
  /** Their share of the service charge. */
  serviceCents: number;
  /** Their share of couvert/discount/other (E6). */
  adjustmentsCents: number;
  totalCents: number;
  /** For the per-person card and the share link. */
  lines: PerPersonLine[];
}

export interface SplitTotals {
  totals: PerPersonTotal[];
  /** Items nobody has claimed (the "ninguém pegou" — only meaningful itemized). */
  unclaimed: SplitItem[];
  /** Sum of every person's total — reconciles to billed items + service + adjustments. */
  grandTotalCents: number;
  ownerTotal: PerPersonTotal | null;
}

/** A line claimed beyond 100% (e.g. a qty-1 item taken whole by two people). */
export interface SplitConflict {
  itemId: string;
  participantIds: string[];
}

/** Result of inferring the service charge from an OCR read + the printed total. */
export interface ServiceChargeDetection {
  serviceCharge: ServiceCharge;
  /** True when nothing could be detected/inferred — the UI must ask the user. */
  needsPrompt: boolean;
}
