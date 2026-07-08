/**
 * C23 / DEC-297 — "Tricount" group split. A NEW aggregate entity (Council C-C):
 * a persistent group event that holds MANY expenses with MANY payers and divides
 * the running total among the group. It is deliberately a separate model from the
 * single-bill `SplitSession` (different mental model + lifecycle) but REUSES the
 * shared transport (public `/g/` link + the same encrypted share-client + claim),
 * the split math primitives, and the trip settle-up.
 *
 * Pure, transport- and persistence-agnostic: all math lives in pure functions
 * over this shape, money is integer cents, and the React/Dexie layers only carry
 * it. The durable form (`GroupSplitRecord`) wraps this with sync metadata.
 *
 * Invariants (Â11): for every expense, Σ(participant shares) == expense.amountCents,
 * and the event total == Σ(expense amounts). Recomputed forward, never persisted
 * as a denormalized number.
 */

import type { ImageRef } from '@/domain/media';
import type { PaymentMethod } from '@/domain/payment';

export type GroupParticipantKind = 'owner' | 'manual' | 'connected';

/**
 * Per-person net settlement lifecycle.
 * - DEC-297 (legacy): `unpaid` → debtor `marked` paid → owner `confirmed`.
 * - DEC-353 (G7, this wave): extends the lifecycle with **fairness states** so the
 *   payer is never penalised for the receiver's inaction. `marked` now means
 *   "marked-paid · awaiting confirmation" and renders **neutral, never red** — only
 *   a `confirmed` (by the receiver, or a logged organizer override) closes the
 *   obligation. `contested` = the receiver rejected a false "paguei"; `cancelled` =
 *   the mark was withdrawn (back to owing). The settlement arithmetic is unchanged —
 *   these states are metadata over the same debt engine.
 */
export type GroupPaymentStatus = 'unpaid' | 'marked' | 'confirmed' | 'contested' | 'cancelled';

export interface GroupParticipant {
  /** Stable id within the event. */
  id: string;
  name: string;
  kind: GroupParticipantKind;
  /**
   * The trip `Participant` this maps to, enabling settle-up sync for people who
   * have the app (DEC-297). Null for manual names and account-less guests.
   */
  linkedParticipantId: string | null;
  /**
   * The guest device actorId that claimed this name through the public link
   * (DEC-297: "a pessoa escolhe o nome"); null until someone claims it.
   */
  claimedByActorId: string | null;
  /** Net settlement stage for this person across the whole event. */
  paymentStatus: GroupPaymentStatus;
  /**
   * ISO timestamp of the owner's latest contest. Used by {@link reduceGroupClaims}
   * to distinguish a guest's OLD mark (pre-contest, should stay contested) from a
   * NEW re-mark (post-contest, should become marked). Absent until the owner first
   * contests this participant.
   */
  contestedAt?: string;
  /**
   * DEC-433 (Field v2) — this person's published repayment methods (Pix/Wise/bank/
   * free-text) so a debtor on the `/g/` board can see HOW to pay this creditor and
   * copy the key. Only the OWNER's ENABLED methods are stamped (from AppSettings) at
   * publish time via {@link withOwnerPaymentMethods}. Additive + optional (absent on
   * legacy rows, manual guests, and anyone who published no method). Display-only —
   * NEVER a money source; the split math ignores it entirely.
   */
  paymentMethods?: PaymentMethod[];
}

export type GroupExpenseSource = 'manual' | 'ai' | 'receipt';
export type GroupSplitMode = 'equal' | 'custom';

/**
 * DEC-337 — one line read off a receipt and kept on a group expense. Slim by
 * design: a group expense splits as a WHOLE among its participants, so items are
 * descriptive metadata (they explain the total + power the detail view, A10),
 * never per-person claims. Additive.
 */
export interface GroupExpenseLineItem {
  id: string;
  description: string;
  /** Line total in integer cents. */
  amountCents: number;
  /** Printed quantity (defaults to 1). */
  qty: number;
}

export interface GroupExpense {
  id: string;
  description: string;
  /** Always > 0, integer cents. */
  amountCents: number;
  /** Who fronted the money (a participant id). */
  paidByParticipantId: string;
  splitMode: GroupSplitMode;
  /** Participants sharing this expense (a non-empty subset of the event). */
  participantIds: string[];
  /** participantId → cents — only meaningful for `custom` mode. */
  customAmountsCents: Record<string, number>;
  category: string;
  /** How the expense got in (manual form, AI parse, or receipt photo). */
  source: GroupExpenseSource;
  createdAt: string;
  /**
   * DEC-336 — the calendar day the expense happened (`YYYY-MM-DD`), distinct from
   * `createdAt` (when it was logged). Additive, non-indexed. Absent on legacy rows
   * (they fall back to `createdAt` for display/grouping).
   */
  occurredAt?: string;
  /**
   * DEC-336 — the participant who REGISTERED the expense, distinct from the payer.
   * Additive. Absent on legacy rows; owner-authored on the owner device, guest-
   * authored from the public board (G4).
   */
  createdByParticipantId?: string;
  /** DEC-337 — receipt lines this expense was built from (item-selection capture). Additive. */
  items?: GroupExpenseLineItem[];
  /**
   * DEC-340 — the guest device (actorId) that AUTHORED this expense through the
   * public board. Additive; absent on owner-authored expenses. Drives idempotent
   * folding (add-or-retract by author) and the "who can remove" rule.
   */
  authoredByActorId?: string;
  /**
   * DEC-342/343 (G5) — LEGACY single receipt image (E2E). Kept for read back-compat
   * with rows minted by 1.2.4-rc; new expenses use {@link GroupExpense.imageRefs}.
   * Read both via `groupExpenseImages`.
   */
  imageRef?: ImageRef;
  /**
   * DEC-348 (G2, this wave) — receipt/proof images for this expense, stored as
   * access-controlled plaintext on R2 and **uploaded on attach** (so they persist
   * across reload, unlike the old upload-on-share). Additive; multiple per expense
   * (F08). Each ref's `r2Id` is the unguessable read capability inside the E2E
   * payload, so every member + the `/g/` web guest can view/download it.
   */
  imageRefs?: ImageRef[];
}

export type GroupSplitStatus = 'open' | 'settled';

/**
 * DEC-354 (G7) — one append-only entry in the group's movement history. A pure,
 * display-only record (NEVER a money source) of who did what: added/removed an
 * expense, marked/confirmed/contested/cancelled a payment, an organizer override,
 * a join via link, a revoke. Structured (not pre-formatted) so the UI renders the
 * human string via `t()` + `formatMoney`. Lives INSIDE the event (so it rides the
 * E2E share payload + backup, never as Worker-readable metadata — DEC-207).
 */
export type GroupActivityKind =
  | 'expense_added'
  | 'expense_removed'
  | 'payment_marked'
  | 'payment_confirmed'
  | 'payment_override'
  | 'payment_contested'
  | 'payment_cancelled'
  | 'participant_joined'
  | 'share_revoked';

export interface GroupActivity {
  id: string;
  /** ISO timestamp the action happened. */
  ts: string;
  /** The device actor that performed it; null for owner-device/local actions. */
  actorId: string | null;
  /** The person who performed it (resolved name), for display. */
  actorName: string;
  kind: GroupActivityKind;
  /** The person the action is ABOUT (e.g. the debtor/payer), when relevant. */
  subjectName?: string;
  /** The receiver/creditor, for payment confirmations + overrides. */
  counterpartName?: string;
  /** A short label of the thing acted on (e.g. an expense description). */
  detail?: string;
  /** Integer cents involved (expense amount / payment amount), when relevant. */
  amountCents?: number;
  /**
   * DEC-363 (Item D) — an OPTIONAL payment proof attached when a debtor marks
   * paid. The full image is access-controlled plaintext on R2 (DEC-348 carve-out);
   * only this ref rides the E2E `/g/` payload + backup. Additive; absent on every
   * non-`payment_marked` entry and on legacy rows. Money math is untouched — a
   * proof is display-only evidence, never a settlement source.
   */
  proof?: ImageRef;
  /**
   * DEC-363 — a tiny inline thumbnail (data URL, ~240px) for instant render. This
   * is the DURABLE proof: it rides the payload/backup within the cap, so the
   * evidence survives even if the full R2 image is later reaped by its TTL.
   */
  proofThumb?: string;
}

export interface GroupSplitEvent {
  id: string;
  name: string;
  /** The group's currency (one per event; matches the trip base when linked). */
  currency: string;
  /** Optional trip link for settle-up sync; null = standalone Tricount. */
  tripId: string | null;
  /** The creator's participant id (always present in `participants`). */
  ownerParticipantId: string;
  participants: GroupParticipant[];
  expenses: GroupExpense[];
  status: GroupSplitStatus;
  createdAt: string;
  /**
   * DEC-340 — owner tombstones for guest-authored expenses the owner removed
   * (hide-never-delete): the reducer refuses to re-fold these ids when a guest's
   * stale snapshot still lists them. Additive; absent = none hidden.
   */
  hiddenExpenseIds?: string[];
  /**
   * DEC-354 (G7) — append-only movement history (display-only). Additive; absent
   * on legacy rows (the timeline shows what exists, no backfill required). Capped
   * (oldest trimmed) by {@link appendGroupActivity}.
   */
  activity?: GroupActivity[];
}

/* ── derived (computed, never persisted) ─────────────────────────────────── */

/** What ONE person paid, owes (their share of all expenses) and their net. */
export interface GroupBalance {
  participantId: string;
  name: string;
  /** Sum of expenses this person fronted. */
  paidCents: number;
  /** Sum of this person's shares across every expense. */
  shareCents: number;
  /** paid − share: positive = the group owes them, negative = they owe the group. */
  netCents: number;
  paymentStatus: GroupPaymentStatus;
}

/** A single suggested transfer that settles the group with minimum movements. */
export interface GroupTransfer {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amountCents: number;
}
